/**
 * Convierte documentos de Firestore (con todas las variantes históricas de la app) al modelo normalizado.
 * Solo LEE: nunca modifica documentos.
 */
import {
  AccMov, CashMov, Closure, Customer, DEFAULT_MIN_STOCK, Expense, Fund, Loc, Pay, Product, Provider,
  Purchase, PurchaseItem, Sale, SaleItem, Status, SupplierPayment, emptyPay,
} from '../core/model';
import { getArgentinaToday, toArgentinaDateString } from '../utils/dateUtils';

const timeFmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });

type Raw = Record<string, any>;

export function isoOf(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch { return ''; } }
  if (v instanceof Date) return v.toISOString();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  return '';
}
function createdIso(d: Raw): string { return d.createdAtIso || isoOf(d.createdAt) || ''; }
function dateOf(d: Raw, ...alt: any[]): string {
  if (typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) return d.date;
  for (const a of [d.date, ...alt, d.createdAtIso, d.createdAt]) {
    const s = toArgentinaDateString(a);
    if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return getArgentinaToday();
}
function timeOf(iso: string): string {
  if (!iso || !iso.includes('T')) return '';
  try { return timeFmt.format(new Date(iso)); } catch { return ''; }
}
/** La app vieja asignaba 'aimogasta' cuando faltaba la sucursal. Se mantiene esa regla. */
export function locOf(v: any): Loc { return v === 'olascoaga' ? 'olascoaga' : 'aimogasta'; }
const statusOf = (d: Raw): Status => (d.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE');
const n = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : Number(v) || 0);

export function normalizeFundName(raw?: any): Fund | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  if (['caja_general', 'cajageneral', 'general', 'recaudacion', 'recaudacion_acumulada', 'recaudación acumulada', 'fondo_general'].includes(s)) return 'caja_general';
  if (['caja_diaria', 'cajadiaria', 'diaria', 'local', 'cajon', 'cash'].includes(s)) return 'caja_diaria';
  if (['mercado_pago', 'mercadopago', 'mp'].includes(s)) return 'mercado_pago';
  if (['transfer', 'transferencia', 'banco'].includes(s)) return 'transfer';
  if (s === 'other') return 'other';
  return undefined;
}

/** Fondo de un gasto/movimiento según lo guardado; sin reglas especiales por importe. */
function resolveFund(d: Raw): { fund: Fund; explicit: boolean } {
  const explicit = normalizeFundName(d.paidFrom || d.paid_from || d.originFund || d.origin_fund || d.fund || d.cashRegisterType);
  if (explicit) return { fund: explicit, explicit: true };
  if (d.paymentMethod === 'mercado_pago') return { fund: 'mercado_pago', explicit: true };
  if (d.paymentMethod === 'transfer') return { fund: 'transfer', explicit: true };
  const text = `${d.description || ''} ${d.notes || ''} ${d.category || ''}`.toLowerCase();
  if (/caja general|caja_general|recaudaci[oó]n acumulada|caja fuerte|reserva acumulada|fondo acumulado/.test(text)) return { fund: 'caja_general', explicit: false };
  return { fund: 'caja_diaria', explicit: false };
}

export function normProduct(id: string, d: Raw): Product {
  const legacy = n(d.stockQuantity ?? d.stock ?? 0);
  const map = d.stockByLocation && typeof d.stockByLocation === 'object' ? d.stockByLocation : null;
  const hasA = map && typeof map.aimogasta === 'number';
  const hasO = map && typeof map.olascoaga === 'number';
  const min = typeof d.minStockAlert === 'number' && d.minStockAlert >= 0 ? d.minStockAlert : undefined;
  const price = typeof (d.salePrice ?? d.price) === 'number' ? (d.salePrice ?? d.price) : undefined;
  const costRaw = d.currentCost ?? d.costPrice ?? d.lastCost;
  return {
    id,
    barcode: String(d.barcode || ''),
    name: d.name || 'Sin nombre',
    brand: d.brand || '',
    category: d.category || 'Otros',
    presentation: d.presentation || '',
    description: d.description || '',
    imageUrl: d.imageUrl || '',
    price: price !== undefined && price > 0 ? price : undefined,
    cost: typeof costRaw === 'number' && costRaw > 0 ? costRaw : undefined,
    stock: { aimogasta: hasA ? map.aimogasta : legacy, olascoaga: hasO ? map.olascoaga : 0 },
    hasMap: !!(hasA && hasO),
    min: min ?? DEFAULT_MIN_STOCK,
    minIsDefault: min === undefined,
    archived: d.archived === true,
    lastSupplierName: d.lastSupplierName || undefined,
    updatedAt: isoOf(d.updatedAt),
  };
}

function payOfSale(d: Raw, total: number): Pay {
  const p = emptyPay();
  const m = d.paymentMethod || 'cash';
  if (m === 'mixed' && d.paymentBreakdown) {
    const b = d.paymentBreakdown;
    p.cash = n(b.cash); p.mp = n(b.mercado_pago ?? b.mp); p.transfer = n(b.transfer); p.credit = n(b.credit);
  } else if (m === 'credit') p.credit = total;
  else if (m === 'mercado_pago') p.mp = total;
  else if (m === 'transfer') p.transfer = total;
  else p.cash = total;
  return p;
}

export function normSale(id: string, d: Raw): Sale {
  const created = createdIso(d);
  const items: SaleItem[] = (Array.isArray(d.items) ? d.items : []).map((i: Raw) => ({
    productId: i.productId || '',
    barcode: i.barcode || '',
    name: i.name || 'Producto',
    qty: n(i.quantity ?? i.qty),
    unitPrice: n(i.unitPrice ?? i.price),
    subtotal: n(i.subtotal ?? n(i.quantity) * n(i.unitPrice)),
    unitCost: typeof i.unitCost === 'number' ? i.unitCost : undefined,
  }));
  const total = n(d.totalAmount);
  return {
    id, date: dateOf(d), time: timeOf(created), createdAt: created, loc: locOf(d.locationId), items, total,
    method: d.paymentMethod || 'cash', pay: payOfSale(d, total),
    customerId: d.customerId || undefined, customerName: d.customerName || undefined,
    status: statusOf(d), cancellationReason: d.cancellationReason || undefined,
    locationChanges: Array.isArray(d.locationHistory) ? d.locationHistory.map((h: Raw) => ({ at: h.changedAtIso || '', reason: h.reason || '', from: h.from || '', to: h.to || '' })) : undefined,
    paymentChanges: Array.isArray(d.paymentHistory) ? d.paymentHistory.map((h: Raw) => ({ at: h.changedAtIso || '', reason: h.reason || '' })) : undefined,
  };
}

export function normAcc(id: string, d: Raw): AccMov {
  const created = createdIso(d);
  const amount = n(d.amount);
  const pay = emptyPay();
  if (d.type === 'PAYMENT') {
    if (d.paymentBreakdown) {
      pay.cash = n(d.paymentBreakdown.cash); pay.mp = n(d.paymentBreakdown.mercado_pago ?? d.paymentBreakdown.mp); pay.transfer = n(d.paymentBreakdown.transfer);
    } else if (d.paymentMethod === 'mercado_pago') pay.mp = amount;
    else if (d.paymentMethod === 'transfer') pay.transfer = amount;
    else pay.cash = amount;
  }
  return {
    id, customerId: d.customerId || '', type: d.type === 'PAYMENT' ? 'PAYMENT' : 'DEBT', amount,
    date: dateOf(d), time: timeOf(created), createdAt: created, loc: locOf(d.locationId), pay,
    saleId: d.saleId || undefined, description: d.description || '', status: statusOf(d),
  };
}

export function normCustomer(id: string, d: Raw): Customer {
  return { id, name: d.name || 'Sin nombre', phone: d.phone || '', notes: d.notes || '' };
}
export function normProvider(id: string, d: Raw): Provider { return { id, name: d.name || 'Sin nombre', phone: d.phone || '' }; }

export function normExpense(id: string, d: Raw): Expense {
  const f = resolveFund(d);
  return {
    id, date: dateOf(d), createdAt: createdIso(d), loc: locOf(d.locationId), category: d.category || 'Otros',
    description: d.description || '', amount: n(d.amount), fund: f.fund, fundExplicit: f.explicit, status: statusOf(d),
    rawLocation: d.locationId,
  };
}

export function normSupplierPayment(id: string, d: Raw): SupplierPayment {
  return {
    id, providerId: d.providerId || '', providerName: d.providerName || 'Proveedor', purchaseId: d.purchaseId || undefined,
    amount: n(d.amount), date: dateOf(d), createdAt: createdIso(d), loc: locOf(d.locationId),
    fund: normalizeFundName(d.paidFrom) || 'caja_diaria', status: statusOf(d),
  };
}

export function normPurchase(id: string, d: Raw): Purchase {
  const total = n(d.totalAmount);
  const paid = d.paidAmount !== undefined ? n(d.paidAmount) : d.paymentStatus === 'PAID' ? total : 0;
  return {
    id, date: dateOf(d), createdAt: createdIso(d), loc: locOf(d.locationId), providerId: d.providerId || '',
    providerName: d.providerName || 'Proveedor', total, paidAmount: paid, itemsCount: n(d.totalItemsCount ?? d.itemsCount),
    status: statusOf(d),
  };
}

export function normPurchaseItem(id: string, d: Raw): PurchaseItem {
  return {
    id, purchaseId: d.purchaseId || '', productId: d.productId || '', name: d.name || 'Producto', qty: n(d.quantity),
    unitCost: n(d.unitCost), previousCost: typeof d.previousCost === 'number' ? d.previousCost : undefined,
    finalSalePrice: n(d.finalSalePrice), margin: typeof d.margin === 'number' ? d.margin : undefined, status: statusOf(d),
  };
}

/** Solo devuelve movimientos manuales y pases a caja general; el resto se deriva de su documento de origen. */
export function normCashMov(id: string, d: Raw): CashMov | null {
  const st = d.sourceType || 'MANUAL';
  if (st !== 'MANUAL' && st !== 'INTERNAL_TRANSFER') return null;
  const created = createdIso(d);
  const f = resolveFund(d);
  let fund = f.fund;
  if (st === 'MANUAL' && !f.explicit && d.paymentMethod === 'cash') fund = f.fund; // efectivo sin aclarar => cajón
  return {
    id, type: d.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME', sourceType: st, amount: n(d.amount), date: dateOf(d), time: timeOf(created),
    createdAt: created, loc: locOf(d.locationId), fund, description: d.description || '', closureId: d.closureId || undefined,
    adjustment: d.adjustment === true, notes: d.notes || '', status: statusOf(d), rawLocation: d.locationId,
  };
}

export function normClosure(id: string, d: Raw): Closure {
  const created = createdIso(d);
  return {
    id, date: dateOf(d), time: timeOf(created), createdAt: created, loc: locOf(d.locationId), expectedCash: n(d.expectedCash),
    countedCash: n(d.countedCash), expectedMp: typeof d.expectedMp === 'number' ? d.expectedMp : undefined,
    countedMp: typeof d.countedMp === 'number' ? d.countedMp : undefined, autoTransferId: d.autoTransferId || undefined,
    notes: d.notes || '', status: statusOf(d), rawLocation: d.locationId,
  };
}
