import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { DataState, emptyData } from '../core/model';
import {
  normAcc, normCashMov, normClosure, normCustomer, normExpense, normProduct, normProvider, normPurchase,
  normPurchaseItem, normSale, normSupplierPayment,
} from './normalize';
import { subscribeSync, SyncState, getSyncState } from './sync';

type Key = keyof DataState;
const SOURCES: { key: Key; col: string; norm: (id: string, d: any) => any }[] = [
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
];

interface Ctx { data: DataState; loaded: boolean; error: string | null; sync: SyncState }
const DataCtx = createContext<Ctx | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<DataState>(emptyData);
  const [ready, setReady] = useState<Set<Key>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>(getSyncState());

  useEffect(() => subscribeSync(setSync), []);

  useEffect(() => {
    const unsubs = SOURCES.map(({ key, col, norm }) =>
      onSnapshot(
        collection(db, col),
        (snap: any) => {
          const list: any[] = [];
          snap.forEach((d: any) => { const v = norm(d.id, d.data()); if (v) list.push(v); });
          if (key === 'products' || key === 'customers' || key === 'providers') list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
          setData((prev) => ({ ...prev, [key]: list }));
          setReady((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
        },
        (err: any) => {
          console.error('Error leyendo ' + col, err);
          setError('No se pudo leer la base de datos (' + col + '). ' + (err?.code === 'permission-denied' ? 'Revisá las reglas de Firestore.' : 'Revisá la conexión.'));
          setReady((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
        }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const value = useMemo(() => ({ data, loaded: ready.size >= SOURCES.length, error, sync }), [data, ready, error, sync]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
};

export function useData(): Ctx {
  const c = useContext(DataCtx);
  if (!c) throw new Error('useData fuera de DataProvider');
  return c;
}
