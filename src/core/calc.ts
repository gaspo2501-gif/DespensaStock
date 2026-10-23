import { DataState, Loc, Product, Purchase, Sale, LOC_IDS, Pay, emptyPay } from './model';
import { getArgentinaToday } from '../utils/dateUtils';

export const today = (): string => getArgentinaToday();

export function addDays(d: string, n: number): string {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n, 12)).toISOString().slice(0, 10);
}

export const sum = <T,>(a: T[], f: (x: T) => number): number => a.reduce((t, x) => t + (f(x) || 0), 0);

export function money(n: number): string {
  const v = Math.round(Math.abs(n || 0));
  return (n < 0 && v !== 0 ? '−' : '') + '$ ' + v.toLocaleString('es-AR');
}

export function parseAmount(v: string | number | undefined | null): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (!v) return 0;
  const s = String(v).trim().replace(/\$/g, '').replace(/\s/g, '');
  // "1.500" o "1.500,50" (formato argentino) o "1500.5"
  const norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s.replace(',', '.');
  const n = parseFloat(norm);
  return isNaN(n) ? 0 : n;
}

/**
 * Precio sugerido con margen sobre el precio de venta (misma regla de la app: costo / (1 − margen)),
 * redondeado hacia arriba a la centena. Con 40% equivale a la fórmula original costo / 0,60.
 */
export function priceFromCost(cost: number, marginPct: number): number {
  if (!(cost > 0) || !(marginPct > 0) || marginPct >= 100) return 0;
  return Math.ceil(cost / (1 - marginPct / 100) / 100) * 100;
}

export const fdate = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '');
export const fdateL = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');

const active = <T extends { status: string }>(x: T) => x.status !== 'CANCELLED';

/* ------------------------- Clientes ------------------------- */
export function balances(data: DataState): Record<string, number> {
  const b: Record<string, number> = {};
  for (const a of data.acc) {
    if (!active(a)) continue;
    b[a.customerId] = (b[a.customerId] || 0) + (a.type === 'DEBT' ? a.amount : -a.amount);
  }
  for (const k of Object.keys(b)) if (b[k] < 0.5) b[k] = Math.max(0, b[k]);
  return b;
}

/* ------------------------- Stock ------------------------- */
export type StockLevel = 'negative' | 'zero' | 'low' | 'ok';
export function stockLevel(p: Product, loc: Loc): StockLevel {
  const q = p.stock[loc];
  if (q < 0) return 'negative';
  if (q === 0) return 'zero';
  if (q <= p.min) return 'low';
  return 'ok';
}
export function lowStock(products: Product[], loc: Loc): Product[] {
  return products
    .filter((p) => !p.archived && p.stock[loc] <= p.min)
    .sort((a, b) => a.stock[loc] - a.min - (b.stock[loc] - b.min) || a.name.localeCompare(b.name, 'es'));
}

/* ------------------------- Compras / proveedores ------------------------- */
export function purchaseState(p: Purchase): 'PAID' | 'PARTIAL' | 'PENDING' | 'CANCELLED' {
  if (p.status === 'CANCELLED') return 'CANCELLED';
  if (p.paidAmount >= p.total - 0.5) return 'PAID';
  if (p.paidAmount > 0) return 'PARTIAL';
  return 'PENDING';
}
export function providerAccount(data: DataState, providerId: string) {
  const purchases = data.purchases.filter((p) => p.providerId === providerId && active(p));
  const pays = data.spays.filter((p) => p.providerId === providerId && active(p));
  const bought = sum(purchases, (p) => p.total);
  const paid = sum(pays, (p) => p.amount);
  return { bought, paid, debt: Math.max(0, bought - paid), purchases, pays };
}

/* ------------------------- Caja ------------------------- */
export interface DayCash {
  cashIn: number; cashOut: number; mpIn: number; mpOut: number; transferIn: number; transferOut: number;
  credit: number; sold: number; salesCount: number; collectedDebt: number;
  manualToGeneral: number; closedCash: number; closedMp: number;
  drawer: number; mpPending: number;
}

/**
 * Caja del día de una sucursal. Todo se deriva de los documentos de origen (ventas, cobros, gastos,
 * pagos a proveedores) y de los movimientos manuales/pases. Así una venta con pago combinado
 * cuenta todas sus partes, aunque el registro viejo de caja haya guardado solo una.
 */
export function dayCash(data: DataState, loc: Loc, date: string): DayCash {
  const r: DayCash = { cashIn: 0, cashOut: 0, mpIn: 0, mpOut: 0, transferIn: 0, transferOut: 0, credit: 0, sold: 0, salesCount: 0, collectedDebt: 0, manualToGeneral: 0, closedCash: 0, closedMp: 0, drawer: 0, mpPending: 0 };
  // Gastos, pagos a proveedores y movimientos manuales solo afectan la caja del día si son con efectivo del cajón.
  // Lo que se paga con Mercado Pago o transferencia sale del Mercado Pago general (ver generalCash), no del día.
  const add = (fund: string, amount: number, inflow: boolean) => {
    if (fund !== 'caja_diaria') return;
    if (inflow) r.cashIn += amount; else r.cashOut += amount;
  };
  for (const s of data.sales) {
    if (!active(s) || s.loc !== loc || s.date !== date) continue;
    r.sold += s.total; r.salesCount++;
    r.cashIn += s.pay.cash; r.mpIn += s.pay.mp; r.transferIn += s.pay.transfer; r.credit += s.pay.credit;
  }
  for (const a of data.acc) {
    if (!active(a) || a.type !== 'PAYMENT' || a.loc !== loc || a.date !== date) continue;
    r.collectedDebt += a.amount;
    r.cashIn += a.pay.cash; r.mpIn += a.pay.mp; r.transferIn += a.pay.transfer;
  }
  for (const e of data.expenses) if (active(e) && e.loc === loc && e.date === date) add(e.fund, e.amount, false);
  for (const p of data.spays) if (active(p) && p.loc === loc && p.date === date) add(p.fund, p.amount, false);
  for (const m of data.cashMovs) {
    if (!active(m) || m.loc !== loc || m.date !== date) continue;
    if (m.sourceType === 'INTERNAL_TRANSFER') { if (!m.closureId) r.manualToGeneral += m.amount; continue; }
    add(m.fund, m.amount, m.type === 'INCOME');
  }
  for (const c of data.closures) {
    if (!active(c) || c.loc !== loc || c.date !== date || !c.autoTransferId && c.expectedMp === undefined) continue;
    r.closedCash += c.expectedCash; r.closedMp += c.expectedMp || 0;
  }
  r.drawer = r.cashIn - r.cashOut - r.manualToGeneral - r.closedCash;
  // Para el control de Mercado Pago del cierre se comparan las ENTRADAS del día (lo que se ve en la app de MP).
  r.mpPending = r.mpIn - r.closedMp;
  return r;
}

/** Caja general: tu plata acumulada (efectivo pasado a caja general + Mercado Pago + transferencias). */
export function generalCash(data: DataState) {
  let cash = 0, mp = 0, transfer = 0;
  const out = (fund: string, a: number) => { if (fund === 'caja_general') cash -= a; else if (fund === 'mercado_pago') mp -= a; else if (fund === 'transfer') transfer -= a; };
  for (const s of data.sales) if (active(s)) { mp += s.pay.mp; transfer += s.pay.transfer; }
  for (const a of data.acc) if (active(a) && a.type === 'PAYMENT') { mp += a.pay.mp; transfer += a.pay.transfer; }
  for (const e of data.expenses) if (active(e)) out(e.fund, e.amount);
  for (const p of data.spays) if (active(p)) out(p.fund, p.amount);
  for (const m of data.cashMovs) {
    if (!active(m)) continue;
    if (m.sourceType === 'INTERNAL_TRANSFER') { cash += m.amount; continue; }
    if (m.type === 'INCOME') { if (m.fund === 'caja_general') cash += m.amount; else if (m.fund === 'mercado_pago') mp += m.amount; else if (m.fund === 'transfer') transfer += m.amount; }
    else out(m.fund, m.amount);
  }
  const t = today();
  const openDrawers = sum(LOC_IDS, (l) => dayCash(data, l, t).drawer);
  return { cash, mp, transfer, total: cash + mp + transfer, openDrawers };
}

/* ------------------------- Reportes ------------------------- */
export type Period = 'today' | 'week' | 'month' | 'lastmonth' | 'range';
export interface Range { a: string; b: string; pa: string; pb: string; label: string; prevLabel: string }

function lastOfMonth(first: string): string {
  const [y, m] = first.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
}
function prevMonthFirst(first: string): string {
  const [y, m] = first.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1, 12)).toISOString().slice(0, 10);
}
export function periodRange(period: Period, from: string, to: string, T: string = today()): Range {
  const first = T.slice(0, 8) + '01';
  const dom = Number(T.slice(8));
  const pf = prevMonthFirst(first);
  switch (period) {
    case 'today': return { a: T, b: T, pa: addDays(T, -1), pb: addDays(T, -1), label: 'Hoy', prevLabel: 'ayer' };
    case 'week': return { a: addDays(T, -6), b: T, pa: addDays(T, -13), pb: addDays(T, -7), label: 'Últimos 7 días', prevLabel: 'los 7 días anteriores' };
    case 'lastmonth': { const pf2 = prevMonthFirst(pf); return { a: pf, b: lastOfMonth(pf), pa: pf2, pb: lastOfMonth(pf2), label: 'Mes anterior', prevLabel: 'el mes previo' }; }
    case 'range': {
      const a = from <= to ? from : to, b = from <= to ? to : from;
      const n = Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
      return { a, b, pa: addDays(a, -n), pb: addDays(a, -1), label: fdateL(a) + ' al ' + fdateL(b), prevLabel: 'los ' + n + ' días anteriores' };
    }
    default: {
      const pb = addDays(pf, Math.min(dom, Number(lastOfMonth(pf).slice(8))) - 1);
      return { a: first, b: T, pa: pf, pb, label: 'Este mes (1 al ' + dom + ')', prevLabel: 'el mismo período del mes anterior' };
    }
  }
}

export interface Metrics {
  sold: number; credit: number; collected: number; collectedDebt: number; purchases: number; expenses: number;
  cogs: number; estimatedItems: number; result: number; salesCount: number; top: { name: string; qty: number; amount: number }[];
}
export function metrics(data: DataState, loc: Loc | 'all', a: string, b: string): Metrics {
  const inR = (x: { date: string; loc: Loc }) => x.date >= a && x.date <= b && (loc === 'all' || x.loc === loc);
  const sales = data.sales.filter((s) => active(s) && inR(s));
  const pays = data.acc.filter((x) => x.type === 'PAYMENT' && active(x) && inR(x));
  const costById = new Map(data.products.map((p) => [p.id, p.cost]));
  let cogs = 0, est = 0;
  const top = new Map<string, { name: string; qty: number; amount: number }>();
  for (const s of sales) for (const i of s.items) {
    if (typeof i.unitCost === 'number') cogs += i.unitCost * i.qty;
    else { cogs += (costById.get(i.productId) || 0) * i.qty; est++; }
    const k = i.productId || i.name;
    const t = top.get(k) || { name: i.name, qty: 0, amount: 0 };
    t.qty += i.qty; t.amount += i.subtotal; top.set(k, t);
  }
  const sold = sum(sales, (s) => s.total);
  const expenses = sum(data.expenses.filter((e) => active(e) && inR(e)), (e) => e.amount);
  return {
    sold,
    credit: sum(sales, (s) => s.pay.credit),
    collected: sum(sales, (s) => s.pay.cash + s.pay.mp + s.pay.transfer) + sum(pays, (x) => x.amount),
    collectedDebt: sum(pays, (x) => x.amount),
    purchases: sum(data.purchases.filter((p) => active(p) && inR(p)), (p) => p.total),
    expenses,
    cogs, estimatedItems: est,
    result: sold - cogs - expenses,
    salesCount: sales.length,
    top: [...top.values()].sort((x, y) => y.amount - x.amount).slice(0, 5),
  };
}

/* ------------------------- Venta ------------------------- */
export function payFromParts(parts: Partial<Pay>): Pay {
  const p = emptyPay();
  (Object.keys(p) as (keyof Pay)[]).forEach((k) => { const v = Number(parts[k] || 0); p[k] = v > 0 ? Math.round(v * 100) / 100 : 0; });
  return p;
}
export const payTotal = (p: Pay) => p.cash + p.mp + p.transfer + p.credit;

export function saleMethodFor(p: Pay): string {
  const legs = (['cash', 'mp', 'transfer', 'credit'] as const).filter((k) => p[k] > 0);
  if (legs.length !== 1) return 'mixed';
  return { cash: 'cash', mp: 'mercado_pago', transfer: 'transfer', credit: 'credit' }[legs[0]];
}

export const isSaleActive = (s: Sale) => active(s);
