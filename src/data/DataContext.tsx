import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, getDocsFromCache, getDocsFromServer, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { DataState, emptyData } from '../core/model';
import {
  normAcc, normCashMov, normClosure, normCustomer, normExpense, normProduct, normProvider, normPurchase,
  normPurchaseItem, normSale, normSupplierPayment, normTransfer,
} from './normalize';
import { subscribeSync, SyncState, getSyncState } from './sync';
import { isQuotaError, STAMP } from './fsx';

type Key = keyof DataState;
const SOURCES: { key: Key; col: string; norm: (id: string, d: any) => any; optional?: boolean }[] = [
  { key: 'products', col: 'products', norm: normProduct },
  { key: 'customers', col: 'customers', norm: normCustomer },
  { key: 'providers', col: 'providers', norm: normProvider },
  { key: 'sales', col: 'sales', norm: normSale },
  { key: 'acc', col: 'account_movements', norm: normAcc },
  { key: 'purchases', col: 'purchases', norm: normPurchase },
  { key: 'purchaseItems', col: 'purchase_items', norm: normPurchaseItem },
  { key: 'spays', col: 'supplier_payments', norm: normSupplierPayment },
  { key: 'expenses', col: 'expenses', norm: normExpense },
  { key: 'cashMovs', col: 'cash_movements', norm: normCashMov },
  { key: 'closures', col: 'cash_closures', norm: normClosure },
  // Solo para mostrar el historial de traspasos: si no se puede leer, la app sigue igual.
  { key: 'transfers', col: 'stock_transfers', norm: normTransfer, optional: true },
];

/*
 * Cómo se cargan los datos (para no agotar el cupo diario gratuito de lecturas de Firebase):
 * 1. Se muestra enseguida lo que ya está guardado en este equipo (no cuesta lecturas).
 * 2. La primera vez en cada equipo se descarga la base completa del servidor (una sola vez).
 * 3. Después solo se escucha lo que cambió hace poco (documentos con `_u` reciente).
 *    Cada apertura cuesta unas pocas lecturas en vez de leer toda la base otra vez.
 */
const META_KEY = 'ds_sync_v1';
const MARGIN = 36 * 3600 * 1000; // margen por relojes desparejos entre equipos
interface Meta { baseline?: number; last?: number }
const loadMeta = (): Meta => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch { return {}; } };
const saveMeta = (m: Meta) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* sin almacenamiento: se vuelve a sincronizar */ } };

/** Borra la marca de sincronización: la próxima apertura vuelve a descargar todo del servidor. */
export function requestFullResync() {
  const m = loadMeta(); delete m.baseline; saveMeta(m);
}

const QUOTA_MSG = 'Se alcanzó el límite diario de lecturas de la base de datos (plan gratuito de Firebase). Podés seguir vendiendo con los datos de este equipo; lo que no se vea se actualiza cuando se renueve el cupo (5 de la mañana).';

interface Ctx { data: DataState; loaded: boolean; error: string | null; sync: SyncState }
const DataCtx = createContext<Ctx | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<DataState>(emptyData);
  const [ready, setReady] = useState<Set<Key>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>(getSyncState());

  useEffect(() => subscribeSync(setSync), []);

  useEffect(() => {
    let alive = true;
    const unsubs: (() => void)[] = [];
    const maps = new Map<Key, Map<string, any>>();
    const raws = new Map<Key, Map<string, number>>(); // id -> _u del documento, para no pisar con datos más viejos
    const publish = (key: Key) => {
      if (!alive) return;
      const list = [...(maps.get(key) || new Map()).values()].filter(Boolean);
      if (key === 'products' || key === 'customers' || key === 'providers') list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      setData((prev) => ({ ...prev, [key]: list }));
      setReady((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    };
    const put = (key: Key, norm: (id: string, d: any) => any, d: any, force = false) => {
      const raw = d.data(); const u = typeof raw?.[STAMP] === 'number' ? raw[STAMP] : 0;
      const seen = raws.get(key)!; const m = maps.get(key)!;
      if (!force && m.has(d.id) && (seen.get(d.id) || 0) > u) return;
      seen.set(d.id, u);
      const v = norm(d.id, raw);
      if (v) m.set(d.id, v); else m.delete(d.id);
    };
    const reportErr = (col: string, optional: boolean | undefined, err: any) => {
      console.error('Error leyendo ' + col, err);
      if (isQuotaError(err)) setError(QUOTA_MSG);
      else if (!optional) setError('No se pudo leer la base de datos (' + col + '). ' + (err?.code === 'permission-denied' ? 'Revisá las reglas de Firestore.' : 'Revisá la conexión.'));
    };

    (async () => {
      const meta = loadMeta();
      const start = Date.now();
      // 1) Lo guardado en este equipo.
      await Promise.all(SOURCES.map(async ({ key, col, norm }) => {
        maps.set(key, new Map()); raws.set(key, new Map());
        try { const snap = await getDocsFromCache(collection(db, col)); snap.forEach((d: any) => put(key, norm, d, true)); } catch { /* sin caché todavía */ }
      }));
      if (!alive) return;
      const hasCache = SOURCES.some(({ key }) => (maps.get(key)?.size || 0) > 0);
      if (meta.baseline || hasCache) SOURCES.forEach(({ key }) => publish(key));

      // 2) Primera vez en este equipo (o pedido de "actualizar todo"): descarga completa, una sola vez.
      let baselineOk = !!meta.baseline;
      if (!meta.baseline) {
        const results = await Promise.all(SOURCES.map(async ({ key, col, norm, optional }) => {
          try {
            const snap = await getDocsFromServer(collection(db, col));
            snap.forEach((d: any) => put(key, norm, d, true));
            publish(key);
            return true;
          } catch (e) {
            reportErr(col, optional, e); publish(key);
            return !!optional; // si falla una colección optativa, igual se da por completa la descarga
          }
        }));
        if (!alive) return;
        baselineOk = results.every(Boolean);
        if (baselineOk) { meta.baseline = start; meta.last = start; saveMeta(meta); }
      }

      // 3) Solo lo que cambió hace poco (incluye lo que se guarda en este equipo sin conexión).
      const since = Math.min(meta.last || start, start) - MARGIN;
      const gotServer = new Set<Key>();
      SOURCES.forEach(({ key, col, norm, optional }) => {
        const q = query(collection(db, col), where(STAMP, '>=', since));
        unsubs.push(onSnapshot(q, { includeMetadataChanges: false }, (snap: any) => {
          snap.forEach((d: any) => put(key, norm, d));
          publish(key);
          if (!snap.metadata.fromCache && baselineOk) {
            gotServer.add(key);
            // Todas las colecciones al día con el servidor: se anota hasta cuándo está sincronizado este equipo.
            if (gotServer.size >= SOURCES.length) { const m = loadMeta(); m.last = Date.now(); if (!m.baseline) m.baseline = meta.baseline; saveMeta(m); gotServer.clear(); }
          }
        }, (err: any) => { reportErr(col, optional, err); publish(key); }));
      });
    })();

    return () => { alive = false; unsubs.forEach((u) => u()); };
  }, []);

  const value = useMemo(() => ({ data, loaded: ready.size >= SOURCES.length, error, sync }), [data, ready, error, sync]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
};

export function useData(): Ctx {
  const c = useContext(DataCtx);
  if (!c) throw new Error('useData fuera de DataProvider');
  return c;
}
