/**
 * Escrituras con marca de cambio.
 *
 * Todo documento que guarda la app lleva `_u` (hora del cambio, en milisegundos).
 * Así cada equipo descarga el historial completo una sola vez y después solo pide
 * lo que tiene `_u` reciente, en vez de volver a leer toda la base en cada apertura
 * (eso era lo que agotaba el cupo diario gratuito de lecturas de Firebase).
 *
 * Son los mismos documentos y campos de siempre; `_u` es un campo opcional más.
 */
import {
  runTransaction as fsRunTransaction, setDoc as fsSetDoc, updateDoc as fsUpdateDoc, writeBatch as fsWriteBatch,
} from 'firebase/firestore';

export const STAMP = '_u';
const stamp = <T extends Record<string, any>>(d: T): T => ({ ...d, [STAMP]: Date.now() });

export function setDoc(ref: any, data: Record<string, any>, opts?: any) {
  return opts ? fsSetDoc(ref, stamp(data), opts) : fsSetDoc(ref, stamp(data));
}
export function updateDoc(ref: any, data: Record<string, any>) {
  return fsUpdateDoc(ref, stamp(data));
}
export function writeBatch(db: any) {
  const b = fsWriteBatch(db);
  const w = {
    set(ref: any, data: Record<string, any>, opts?: any) { if (opts) b.set(ref, stamp(data), opts); else b.set(ref, stamp(data)); return w; },
    update(ref: any, data: Record<string, any>) { b.update(ref, stamp(data)); return w; },
    commit() { return b.commit(); },
  };
  return w;
}
export function runTransaction<T>(db: any, fn: (tx: any) => Promise<T>): Promise<T> {
  return fsRunTransaction(db, (tx: any) => {
    const w: any = {
      get: (ref: any) => tx.get(ref),
      set(ref: any, data: Record<string, any>, opts?: any) { if (opts) tx.set(ref, stamp(data), opts); else tx.set(ref, stamp(data)); return w; },
      update(ref: any, data: Record<string, any>) { tx.update(ref, stamp(data)); return w; },
    };
    return fn(w);
  });
}

/** Errores de Firebase por cupo diario agotado. */
export const isQuotaError = (e: any) => e?.code === 'resource-exhausted' || /quota/i.test(String(e?.message || ''));
