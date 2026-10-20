/**
 * Copia de seguridad: descarga TODOS los documentos de la base en un archivo .json.
 * Solo lee; no modifica nada.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase/config';

const COLLECTIONS = [
  'products', 'customers', 'providers', 'sales', 'account_movements', 'purchases', 'purchase_items', 'supplier_payments',
  'expenses', 'cash_movements', 'cash_closures', 'stock_transfers', 'stock_adjustments',
];

export async function downloadBackup(): Promise<number> {
  const out: Record<string, Record<string, unknown>> = {};
  let count = 0;
  for (const c of COLLECTIONS) {
    const snap = await getDocs(collection(db, c));
    out[c] = {};
    snap.forEach((d: any) => {
      out[c][d.id] = JSON.parse(JSON.stringify(d.data(), (_k, v) => (v && typeof v.toDate === 'function' ? { __timestamp: v.toDate().toISOString() } : v)));
      count++;
    });
  }
  const blob = new Blob([JSON.stringify({ app: 'DespensaStock', exportedAt: new Date().toISOString(), collections: out }, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'despensastock-copia-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return count;
}
