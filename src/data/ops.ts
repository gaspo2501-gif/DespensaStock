/**
 * Escrituras de DespensaStock v2.
 *
 * Reglas de compatibilidad:
 * - Se escriben los mismos documentos, colecciones y campos que usaba la app anterior.
 * - Solo se agregan campos opcionales (unitCost, margin, minStockAlert, archived, expectedMp, countedMp,
 *   autoTransferId, closureId, paymentBreakdown en cobros combinados).
 * - Nunca se borra un documento: se anula (status: 'CANCELLED') o se archiva.
 * - Si Firestore rechaza una escritura con conexión, el error llega a la pantalla (no se muestra "guardado").
 */
import {
  collection, deleteField, doc, getDocs, increment, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch, setDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { getArgentinaToday } from '../utils/dateUtils';
import { Customer, Fund, Loc, LOCS, Pay, Product, Purchase } from '../core/model';
import { payTotal, saleMethodFor } from '../core/calc';
import { isOnline, runWrite } from './sync';
import { salesService } from '../services/firebase/salesService';
import { expenseService } from '../services/firebase/expenseService';

const rnd = () => Math.random().toString(36).slice(2, 7);
const nowIso = () => new Date().toISOString();
const ts = serverTimestamp;

/** Stock en la sucursal leído de un documento crudo (mismas reglas de la app anterior). */
function rawStock(d: any): { aimogasta: number; olascoaga: number } {
  const legacy = Number(d?.stockQuantity ?? d?.stock ?? 0) || 0;
  const m = d?.stockByLocation && typeof d.stockByLocation === 'object' ? d.stockByLocation : {};
  return {
    aimogasta: typeof m.aimogasta === 'number' ? m.aimogasta : legacy,
    olascoaga: typeof m.olascoaga === 'number' ? m.olascoaga : 0,
  };
}
function fullStockUpdate(map: { aimogasta: number; olascoaga: number }) {
  const total = map.aimogasta + map.olascoaga;
  return { stockByLocation: { aimogasta: map.aimogasta, olascoaga: map.olascoaga }, stockQuantity: total, stock: total };
}
/**
 * Cambio de stock sin leer antes: si el producto ya tiene el mapa por sucursal, usa sumas atómicas
 * (no pisa lo que se vendió en la otra sucursal al mismo tiempo). Si es un producto viejo sin mapa,
 * escribe el mapa completo a partir de lo que se conoce.
 */
function deltaStockUpdate(p: Product, loc: Loc, delta: number): Record<string, any> {
  if (p.hasMap) {
    return { [`stockByLocation.${loc}`]: increment(delta), stockQuantity: increment(delta), stock: increment(delta) };
  }
  const map = { ...p.stock, [loc]: p.stock[loc] + delta };
  return fullStockUpdate(map);
}

export class UserError extends Error {}

/* ============================ VENTAS ============================ */
export interface SaleLine { product: Product; qty: number; unitPrice: number; savePrice?: boolean }

export async function createSale(args: { lines: SaleLine[]; pay: Pay; customer?: Customer; loc: Loc }) {
  const { lines, pay, customer, loc } = args;
  if (!lines.length) throw new UserError('El carrito está vacío.');
  const total = Math.round(lines.reduce((t, l) => t + l.qty * l.unitPrice, 0) * 100) / 100;
  if (Math.abs(payTotal(pay) - total) >= 1) throw new UserError('Las partes del pago tienen que sumar el total de la venta.');
  if (pay.credit > 0 && !customer) throw new UserError('Elegí el cliente a cuyo nombre queda el fiado.');
  if (lines.some((l) => !(l.unitPrice > 0))) throw new UserError('Hay productos sin precio.');

  const method = saleMethodFor(pay);
  const saleId = `sale_${Date.now()}_${rnd()}`;
  const iso = nowIso();
  const date = getArgentinaToday();
  const items = lines.map((l) => {
    const it: Record<string, any> = {
      productId: l.product.id, barcode: l.product.barcode, name: l.product.name, brand: l.product.brand || '',
      presentation: l.product.presentation || '', quantity: l.qty, unitPrice: l.unitPrice, subtotal: l.qty * l.unitPrice,
    };
    if (typeof l.product.cost === 'number') it.unitCost = l.product.cost; // costo al momento de la venta
    return it;
  });
  const sale: Record<string, any> = {
    id: saleId, date, createdAt: ts(), createdAtIso: iso, items, totalAmount: total,
    totalItemsCount: lines.reduce((t, l) => t + l.qty, 0), paymentMethod: method, locationId: loc,
  };
  if (method === 'mixed') sale.paymentBreakdown = { cash: pay.cash, mercado_pago: pay.mp, transfer: pay.transfer, credit: pay.credit };
  if (customer && pay.credit > 0) { sale.customerId = customer.id; sale.customerName = customer.name; }
  const debt = pay.credit > 0 && customer ? {
    id: `mov_debt_${Date.now()}_${rnd()}`, customerId: customer.id, type: 'DEBT', amount: pay.credit,
    description: method === 'credit' ? 'Venta fiada' : 'Venta fiada (pago combinado)', saleId, locationId: loc,
    createdAtIso: iso, createdAt: ts(),
  } : null;

  const saleRef = doc(db, 'sales', saleId);
  if (isOnline()) {
    try {
      await runTransaction(db, async (tx: any) => {
        const snaps: any[] = [];
        for (const l of lines) snaps.push(await tx.get(doc(db, 'products', l.product.id)));
        lines.forEach((l, i) => {
          const s = snaps[i];
          if (!s.exists()) throw new UserError(`“${l.product.name}” ya no existe en el catálogo.`);
          const st = rawStock(s.data());
          if (st[loc] < l.qty) throw new UserError(`No alcanza el stock de “${l.product.name}” en ${LOCS[loc]}: hay ${st[loc]}.`);
          const upd: Record<string, any> = { ...fullStockUpdate({ ...st, [loc]: st[loc] - l.qty }), updatedAt: ts() };
          if (l.savePrice) upd.salePrice = l.unitPrice;
          tx.update(s.ref, upd);
        });
        tx.set(saleRef, sale);
        if (debt) tx.set(doc(db, 'account_movements', debt.id), debt);
      });
      return { saleId, total, queued: false };
    } catch (e: any) {
      if (e instanceof UserError) throw e;
      const code = e?.code || '';
      if (code !== 'unavailable' && code !== 'deadline-exceeded') throw e;
      // Sin respuesta del servidor: se guarda en el equipo como venta sin conexión.
    }
  }
  const b = writeBatch(db);
  for (const l of lines) {
    const upd: Record<string, any> = { ...deltaStockUpdate(l.product, loc, -l.qty), updatedAt: ts() };
    if (l.savePrice) upd.salePrice = l.unitPrice;
    b.update(doc(db, 'products', l.product.id), upd);
  }
  b.set(saleRef, { ...sale, savedOffline: true });
  if (debt) b.set(doc(db, 'account_movements', debt.id), debt);
  const r = await runWrite(() => b.commit());
  return { saleId, total, queued: r === 'queued' };
}

export async function cancelSale(saleId: string, reason: string) {
  if (!isOnline()) throw new UserError('Para anular una venta hace falta conexión.');
  if (!reason.trim()) throw new UserError('Escribí el motivo de la anulación.');
  await salesService.cancelSale(saleId, reason); // misma lógica atómica de la app anterior
  return true;
}

/**
 * Corrige la forma de pago de una venta ya registrada (por ejemplo, se cargó en efectivo y era Mercado Pago).
 * No toca el stock ni los productos. Las cajas se recalculan solas porque se derivan de la venta.
 * Si la venta tenía fiado, se anula esa deuda; si la nueva forma tiene fiado, se crea la deuda nueva.
 * Queda guardado el historial del cambio en la propia venta (paymentHistory).
 */
export async function changeSalePayment(args: { saleId: string; pay: Pay; customer?: Customer; reason?: string; customerBalance?: number }) {
  const { saleId, pay, customer, reason } = args;
  if (!isOnline()) throw new UserError('Para cambiar la forma de pago hace falta conexión.');
  if (pay.credit > 0 && !customer) throw new UserError('Elegí el cliente a cuyo nombre queda el fiado.');
  const [debtSnap, cashSnap] = await Promise.all([
    getDocs(query(collection(db, 'account_movements'), where('saleId', '==', saleId))),
    getDocs(query(collection(db, 'cash_movements'), where('sourceId', '==', saleId))),
  ]);
  const iso = nowIso();
  const why = (reason || '').trim() || 'Cambio de forma de pago';
  let summary = '';
  await runTransaction(db, async (tx: any) => {
    const ref = doc(db, 'sales', saleId);
    const s = await tx.get(ref);
    if (!s.exists()) throw new UserError('No se encontró la venta.');
    const d = s.data();
    if (d.status === 'CANCELLED') throw new UserError('La venta está anulada.');
    const total = Number(d.totalAmount) || 0;
    if (Math.abs(payTotal(pay) - total) >= 1) throw new UserError('Las partes del pago tienen que sumar el total de la venta.');
    const debts: any[] = [];
    for (const m of debtSnap.docs) { const x = await tx.get(m.ref); if (x.exists() && x.data().type === 'DEBT' && x.data().status !== 'CANCELLED') debts.push(x); }
    const cash: any[] = [];
    for (const m of cashSnap.docs) { const x = await tx.get(m.ref); if (x.exists() && x.data().sourceType === 'SALE' && x.data().status !== 'CANCELLED') cash.push(x); }
    const oldCredit = debts.reduce((t, x) => t + (Number(x.data().amount) || 0), 0);
    const oldCustomer = d.customerId || (debts[0] && debts[0].data().customerId);
    // No permitir quitar un fiado que el cliente ya empezó a pagar (quedaría saldo a favor sin control).
    if (oldCredit > 0 && typeof args.customerBalance === 'number') {
      const sameCustomer = customer && customer.id === oldCustomer;
      const stays = sameCustomer ? pay.credit : 0;
      if (args.customerBalance - oldCredit + stays < -0.5) throw new UserError('No se puede quitar ese fiado: el cliente ya pagó parte de la deuda. Registralo como un cobro.');
    }
    const method = saleMethodFor(pay);
    const before = { paymentMethod: d.paymentMethod || 'cash', paymentBreakdown: d.paymentBreakdown || null, customerId: d.customerId || null };
    const after = { paymentMethod: method, paymentBreakdown: method === 'mixed' ? { cash: pay.cash, mercado_pago: pay.mp, transfer: pay.transfer, credit: pay.credit } : null, customerId: pay.credit > 0 && customer ? customer.id : null };
    const upd: Record<string, any> = {
      paymentMethod: method,
      paymentBreakdown: method === 'mixed' ? after.paymentBreakdown : deleteField(),
      paymentHistory: [...(Array.isArray(d.paymentHistory) ? d.paymentHistory : []), { changedAtIso: iso, reason: why, before, after }],
      updatedAt: ts(),
    };
    if (pay.credit > 0 && customer) { upd.customerId = customer.id; upd.customerName = customer.name; }
    else { upd.customerId = deleteField(); upd.customerName = deleteField(); }
    tx.update(ref, upd);
    const cancel = { status: 'CANCELLED', cancelledAt: ts(), cancelledAtIso: iso, cancellationReason: why };
    for (const x of debts) tx.update(x.ref, cancel);
    for (const x of cash) tx.update(x.ref, cancel); // registros de caja viejos de esta venta (la app nueva no los usa)
    if (pay.credit > 0 && customer) {
      const id = `mov_debt_${Date.now()}_${rnd()}`;
      tx.set(doc(db, 'account_movements', id), {
        id, customerId: customer.id, type: 'DEBT', amount: pay.credit, description: method === 'credit' ? 'Venta fiada' : 'Venta fiada (pago combinado)',
        saleId, locationId: d.locationId || 'aimogasta', createdAtIso: d.createdAtIso || iso, createdAt: d.createdAt || ts(), notes: 'Por cambio de forma de pago',
      });
    }
    summary = method;
  });
  return summary || 'ok';
}

/**
 * Pasa una venta a la otra sucursal (se cargó en la sucursal equivocada).
 * Devuelve el stock a la sucursal original y lo descuenta en la nueva; la deuda de fiado y las cajas
 * pasan a la sucursal nueva. Queda guardado el historial en la venta (locationHistory).
 */
export async function changeSaleLocation(saleId: string, to: Loc, reason?: string) {
  if (!isOnline()) throw new UserError('Para cambiar la sucursal de una venta hace falta conexión.');
  const [debtSnap, cashSnap] = await Promise.all([
    getDocs(query(collection(db, 'account_movements'), where('saleId', '==', saleId))),
    getDocs(query(collection(db, 'cash_movements'), where('sourceId', '==', saleId))),
  ]);
  const iso = nowIso();
  const why = (reason || '').trim() || 'Cambio de sucursal';
  const negatives: string[] = [];
  await runTransaction(db, async (tx: any) => {
    const ref = doc(db, 'sales', saleId);
    const s = await tx.get(ref);
    if (!s.exists()) throw new UserError('No se encontró la venta.');
    const d = s.data();
    if (d.status === 'CANCELLED') throw new UserError('La venta está anulada.');
    const from: Loc = d.locationId === 'olascoaga' ? 'olascoaga' : 'aimogasta';
    if (from === to) throw new UserError('La venta ya está en ' + LOCS[to] + '.');
    const byProd = new Map<string, { qty: number; name: string }>();
    for (const it of (Array.isArray(d.items) ? d.items : [])) {
      if (!it.productId) continue;
      const x = byProd.get(it.productId) || { qty: 0, name: it.name || 'Producto' };
      x.qty += Number(it.quantity) || 0; byProd.set(it.productId, x);
    }
    const keys = [...byProd.keys()];
    const prodSnaps: any[] = [];
    for (const k of keys) prodSnaps.push(await tx.get(doc(db, 'products', k)));
    const others: any[] = [];
    for (const m of [...debtSnap.docs, ...cashSnap.docs]) { const x = await tx.get(m.ref); if (x.exists()) others.push(x); }
    prodSnaps.forEach((ps, i) => {
      if (!ps.exists()) return;
      const x = byProd.get(keys[i])!;
      const st = rawStock(ps.data());
      const next = { ...st, [from]: st[from] + x.qty, [to]: st[to] - x.qty };
      if (next[to] < 0) negatives.push(x.name + ' (' + next[to] + ')');
      tx.update(ps.ref, { ...fullStockUpdate(next), updatedAt: ts() });
    });
    tx.update(ref, {
      locationId: to,
      locationHistory: [...(Array.isArray(d.locationHistory) ? d.locationHistory : []), { changedAtIso: iso, reason: why, from, to }],
      updatedAt: ts(),
    });
    for (const x of others) tx.update(x.ref, { locationId: to });
  });
  return { negatives };
}

/** Pasar un gasto o un cobro de fiado a la otra sucursal (no mueve stock). */
export async function changeRecordLocation(col: 'expenses' | 'account_movements', id: string, to: Loc) {
  if (!isOnline()) throw new UserError('Para cambiar la sucursal hace falta conexión.');
  await updateDoc(doc(db, col, id), { locationId: to, updatedAt: ts() });
  return true;
}

/* ============================ CLIENTES ============================ */
export async function createCustomer(name: string, phone: string): Promise<Customer> {
  const clean = name.trim();
  if (!clean) throw new UserError('Escribí el nombre del cliente.');
  const id = `cust_${Date.now()}_${rnd()}`;
  const iso = nowIso();
  await runWrite(() => setDoc(doc(db, 'customers', id), { id, name: clean, phone: phone.trim(), notes: '', createdAtIso: iso, updatedAtIso: iso, createdAt: ts(), updatedAt: ts() }));
  return { id, name: clean, phone: phone.trim(), notes: '' };
}

export async function registerCustomerPayment(args: { customerId: string; amount: number; cash: number; mp: number; balance: number; loc: Loc }) {
  const { customerId, amount, cash, mp, balance, loc } = args;
  if (!(amount > 0)) throw new UserError('Ingresá cuánto paga.');
  if (amount > balance + 0.5) throw new UserError('El pago no puede superar lo que debe.');
  if (Math.abs(cash + mp - amount) >= 1) throw new UserError('Efectivo y Mercado Pago tienen que sumar lo que paga.');
  const id = `mov_pay_${Date.now()}_${rnd()}`;
  const method = cash > 0 && mp > 0 ? 'mixed' : mp > 0 ? 'mercado_pago' : 'cash';
  const payload: Record<string, any> = {
    id, customerId, type: 'PAYMENT', amount, paymentMethod: method, locationId: loc, description: 'Pago a cuenta',
    createdAtIso: nowIso(), createdAt: ts(),
  };
  if (method === 'mixed') payload.paymentBreakdown = { cash, mercado_pago: mp };
  return runWrite(() => setDoc(doc(db, 'account_movements', id), payload));
}

/* ============================ PRODUCTOS ============================ */
export interface ProductInput {
  name: string; barcode: string; category: string; brand?: string; presentation?: string; description?: string; imageUrl?: string;
  price?: number; min?: number; initialStock?: number; source?: string;
}
export async function saveNewProduct(input: ProductInput, loc: Loc, existing: Product[]): Promise<string> {
  const code = input.barcode.trim(), name = input.name.trim();
  if (!name) throw new UserError('Escribí el nombre del producto.');
  if (!code) throw new UserError('Escribí o escaneá el código de barras.');
  const dup = existing.find((p) => p.barcode === code);
  if (dup) throw new UserError(`Ese código ya es de “${dup.name}”.`);
  const id = `prod_${code}_${Date.now()}`;
  const st = Math.max(0, Math.round(input.initialStock || 0));
  const map = { aimogasta: loc === 'aimogasta' ? st : 0, olascoaga: loc === 'olascoaga' ? st : 0 };
  const data: Record<string, any> = {
    barcode: code, name, brand: (input.brand || '').trim(), category: input.category || 'Otros', presentation: (input.presentation || '').trim(),
    description: (input.description || '').trim(), imageUrl: (input.imageUrl || '').trim(), source: input.source || 'manual',
    createdAt: ts(), updatedAt: ts(), ...fullStockUpdate(map),
  };
  if (input.price && input.price > 0) data.salePrice = input.price;
  if (typeof input.min === 'number' && input.min >= 0) data.minStockAlert = Math.round(input.min);
  await runWrite(() => setDoc(doc(db, 'products', id), data));
  return id;
}
export async function updateProduct(p: Product, input: ProductInput, existing: Product[]) {
  const code = input.barcode.trim(), name = input.name.trim();
  if (!name) throw new UserError('Escribí el nombre del producto.');
  if (!code) throw new UserError('Escribí o escaneá el código de barras.');
  const dup = existing.find((x) => x.barcode === code && x.id !== p.id);
  if (dup) throw new UserError(`Ese código ya es de “${dup.name}”.`);
  const upd: Record<string, any> = { name, barcode: code, category: input.category || 'Otros', brand: (input.brand || '').trim(), presentation: (input.presentation || '').trim(), updatedAt: ts() };
  if (input.price && input.price > 0) upd.salePrice = input.price;
  if (typeof input.min === 'number' && input.min >= 0) upd.minStockAlert = Math.round(input.min);
  await runWrite(() => updateDoc(doc(db, 'products', p.id), upd));
}
export async function archiveProduct(p: Product) {
  if (p.stock.aimogasta !== 0 || p.stock.olascoaga !== 0) throw new UserError('Para archivar un producto su stock tiene que estar en 0 en las dos sucursales.');
  await runWrite(() => updateDoc(doc(db, 'products', p.id), { archived: true, updatedAt: ts() }));
  return true;
}
export async function adjustStock(p: Product, loc: Loc, op: 'add' | 'sub' | 'set', qty: number, reason: string) {
  if (!isOnline()) throw new UserError('Para ajustar stock a mano hace falta conexión.');
  if (!(qty >= 0)) throw new UserError('Ingresá la cantidad.');
  if (!reason) throw new UserError('Elegí el motivo del ajuste.');
  const ref = doc(db, 'products', p.id);
  let before = 0, after = 0;
  await runTransaction(db, async (tx: any) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new UserError('El producto ya no existe.');
    const st = rawStock(s.data());
    before = st[loc];
    after = op === 'add' ? before + qty : op === 'sub' ? before - qty : qty;
    if (after < 0) throw new UserError(`No se puede dejar el stock en negativo (hay ${before}).`);
    tx.update(ref, { ...fullStockUpdate({ ...st, [loc]: after }), updatedAt: ts() });
    const aid = `adj_${Date.now()}_${rnd()}`;
    tx.set(doc(db, 'stock_adjustments', aid), { id: aid, productId: p.id, productName: p.name, locationId: loc, before, after, reason, createdAtIso: nowIso(), createdAt: ts() });
  });
  return { before, after };
}
export async function transferStock(p: Product, from: Loc, qty: number) {
  if (!isOnline()) throw new UserError('Para pasar stock entre sucursales hace falta conexión.');
  if (!(qty > 0)) throw new UserError('Ingresá cuántas unidades pasás.');
  const to: Loc = from === 'aimogasta' ? 'olascoaga' : 'aimogasta';
  const ref = doc(db, 'products', p.id);
  await runTransaction(db, async (tx: any) => {
    const s = await tx.get(ref);
    const st = rawStock(s.data());
    if (st[from] < qty) throw new UserError(`En ${LOCS[from]} hay ${st[from]}.`);
    tx.update(ref, { ...fullStockUpdate({ ...st, [from]: st[from] - qty, [to]: st[to] + qty }), updatedAt: ts() });
    const id = `trans_${Date.now()}_${rnd()}`;
    tx.set(doc(db, 'stock_transfers', id), {
      id, date: getArgentinaToday(), productId: p.id, barcode: p.barcode, productName: p.name, quantity: qty,
      sourceLocationId: from, sourceLocationName: LOCS[from], destinationLocationId: to, destinationLocationName: LOCS[to],
      notes: '', createdAtIso: nowIso(), createdAt: ts(),
    });
  });
  return true;
}

/* ============================ COMPRAS ============================ */
export interface PurchaseLine { product: Product; qty: number; unitCost: number; margin: number; price: number; suggested: number }

export async function createPurchase(args: { providerId: string; providerName: string; loc: Loc; lines: PurchaseLine[]; paid: number; fund?: Fund }) {
  const { providerId, providerName, loc, lines, paid, fund } = args;
  if (!providerId) throw new UserError('Elegí el proveedor.');
  if (!lines.length) throw new UserError('Agregá al menos un producto.');
  const bad = lines.find((l) => !(l.qty > 0) || !(l.unitCost > 0) || !(l.price > 0));
  if (bad) throw new UserError(`Revisá cantidad, costo y precio de “${bad.product.name}”.`);
  const total = lines.reduce((t, l) => t + l.qty * l.unitCost, 0);
  if (paid < 0 || paid > total + 0.5) throw new UserError('El pago no puede superar el total del ingreso.');
  if (paid > 0 && !fund) throw new UserError('Elegí de dónde salió la plata del pago.');
  const iso = nowIso(); const date = getArgentinaToday();
  const purchaseId = `purch_${Date.now()}_${rnd()}`;
  const pending = Math.max(0, total - paid);
  const status = pending <= 0.5 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';
  const b = writeBatch(db);
  const pur: Record<string, any> = {
    id: purchaseId, date, providerId, providerName, createdAt: ts(), createdAtIso: iso, totalAmount: total,
    totalItemsCount: lines.reduce((t, l) => t + l.qty, 0), itemsCount: lines.length, locationId: loc,
    paymentStatus: status, paidAmount: paid, pendingAmount: pending,
  };
  if (paid > 0 && fund) pur.paidFrom = fund;
  b.set(doc(db, 'purchases', purchaseId), pur);
  for (const l of lines) {
    const iid = `pitem_${Date.now()}_${rnd()}`;
    const item: Record<string, any> = {
      id: iid, productId: l.product.id, barcode: l.product.barcode, name: l.product.name, brand: l.product.brand || '',
      presentation: l.product.presentation || '', category: l.product.category || 'Otros', providerId, providerName, purchaseId,
      quantity: l.qty, unitCost: l.unitCost, totalCost: l.qty * l.unitCost, newCost: l.unitCost, suggestedSalePrice: l.suggested,
      finalSalePrice: l.price, margin: l.margin, purchaseDate: ts(), locationId: loc,
    };
    if (typeof l.product.cost === 'number') item.previousCost = l.product.cost;
    if (typeof l.product.price === 'number') item.previousSalePrice = l.product.price;
    b.set(doc(db, 'purchase_items', iid), item);
    b.update(doc(db, 'products', l.product.id), {
      ...deltaStockUpdate(l.product, loc, l.qty), currentCost: l.unitCost, lastCost: l.unitCost, costPrice: l.unitCost,
      salePrice: l.price, lastPurchaseDate: ts(), lastSupplierId: providerId, lastSupplierName: providerName, updatedAt: ts(),
    });
  }
  if (paid > 0 && fund) {
    const sid = `spay_${Date.now()}_${rnd()}`;
    b.set(doc(db, 'supplier_payments', sid), {
      id: sid, providerId, providerName, purchaseId, amount: paid, date, paidFrom: fund, locationId: loc,
      notes: `Pago inicial compra #${purchaseId.slice(-6)}`, createdAtIso: iso, createdAt: ts(),
    });
  }
  const r = await runWrite(() => b.commit());
  return { purchaseId, total, paid, queued: r === 'queued' };
}

export async function cancelPurchase(purchaseId: string, reason: string) {
  if (!isOnline()) throw new UserError('Para anular un ingreso hace falta conexión.');
  if (!reason.trim()) throw new UserError('Escribí el motivo de la anulación.');
  const [itemsSnap, paysSnap, cashSnap] = await Promise.all([
    getDocs(query(collection(db, 'purchase_items'), where('purchaseId', '==', purchaseId))),
    getDocs(query(collection(db, 'supplier_payments'), where('purchaseId', '==', purchaseId))),
    getDocs(query(collection(db, 'cash_movements'), where('purchaseId', '==', purchaseId))),
  ]);
  const iso = nowIso();
  const cancel = { status: 'CANCELLED', cancelledAt: ts(), cancelledAtIso: iso, cancellationReason: reason.trim() };
  let returned = 0;
  await runTransaction(db, async (tx: any) => {
    const pRef = doc(db, 'purchases', purchaseId);
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists()) throw new UserError('No se encontró el ingreso.');
    if (pSnap.data().status === 'CANCELLED') throw new UserError('Este ingreso ya estaba anulado.');
    const loc: Loc = pSnap.data().locationId === 'olascoaga' ? 'olascoaga' : 'aimogasta';
    const items = itemsSnap.docs.map((d: any) => d.data());
    // agrupar por producto
    const byProd = new Map<string, { qty: number; name: string }>();
    for (const it of items) { const x = byProd.get(it.productId) || { qty: 0, name: it.name }; x.qty += Number(it.quantity) || 0; byProd.set(it.productId, x); }
    const prodSnaps: any[] = [];
    for (const pid of byProd.keys()) prodSnaps.push(await tx.get(doc(db, 'products', pid)));
    const paySnaps: any[] = [];
    for (const d of paysSnap.docs) paySnaps.push(await tx.get(d.ref));
    const cashSnaps: any[] = [];
    for (const d of cashSnap.docs) cashSnaps.push(await tx.get(d.ref));
    // validar todo antes de escribir
    const keys = [...byProd.keys()];
    prodSnaps.forEach((s, i) => {
      if (!s.exists()) return;
      const st = rawStock(s.data()); const x = byProd.get(keys[i])!;
      if (st[loc] < x.qty) throw new UserError(`No se puede anular: de “${x.name}” quedan ${st[loc]} en ${LOCS[loc]} y entraron ${x.qty}.`);
    });
    prodSnaps.forEach((s, i) => {
      if (!s.exists()) return;
      const st = rawStock(s.data()); const x = byProd.get(keys[i])!;
      tx.update(s.ref, { ...fullStockUpdate({ ...st, [loc]: st[loc] - x.qty }), updatedAt: ts() });
    });
    for (const s of paySnaps) if (s.exists() && s.data().status !== 'CANCELLED') { returned += Number(s.data().amount) || 0; tx.update(s.ref, cancel); }
    for (const s of cashSnaps) if (s.exists() && s.data().status !== 'CANCELLED') tx.update(s.ref, cancel);
    for (const d of itemsSnap.docs) tx.update(d.ref, cancel);
    tx.update(pRef, { ...cancel, paidAmount: 0, pendingAmount: 0 });
  });
  return { returned };
}

/** Pago a proveedor: se aplica a los ingresos pendientes del más viejo al más nuevo. */
export async function payProvider(args: { providerId: string; providerName: string; amount: number; fund: Fund; loc: Loc; debt: number; purchases: Purchase[] }) {
  const { providerId, providerName, amount, fund, loc, debt, purchases } = args;
  if (!isOnline()) throw new UserError('Para registrar un pago a proveedor hace falta conexión.');
  if (!(amount > 0)) throw new UserError('Ingresá el importe.');
  if (amount > debt + 0.5) throw new UserError('El pago supera la deuda con el proveedor.');
  if (!fund) throw new UserError('Elegí de dónde sale la plata.');
  const open = purchases.filter((p) => p.status !== 'CANCELLED' && p.total - p.paidAmount > 0.5).sort((a, b) => (a.createdAt || a.date).localeCompare(b.createdAt || b.date));
  const iso = nowIso(); const date = getArgentinaToday();
  await runTransaction(db, async (tx: any) => {
    const snaps: any[] = [];
    for (const p of open) snaps.push(await tx.get(doc(db, 'purchases', p.id)));
    let left = amount;
    snaps.forEach((s) => {
      if (left <= 0 || !s.exists()) return;
      const d = s.data(); const total = Number(d.totalAmount) || 0; const prev = Number(d.paidAmount) || 0;
      const x = Math.min(left, total - prev); if (x <= 0) return;
      left -= x;
      const next = prev + x; const pend = Math.max(0, total - next);
      tx.update(s.ref, { paidAmount: next, pendingAmount: pend, paymentStatus: pend <= 0.5 ? 'PAID' : 'PARTIAL', updatedAt: ts() });
      const sid = `spay_${Date.now()}_${rnd()}`;
      tx.set(doc(db, 'supplier_payments', sid), { id: sid, providerId, providerName, purchaseId: s.id, amount: x, date, paidFrom: fund, locationId: loc, notes: 'Pago a proveedor', createdAtIso: iso, createdAt: ts() });
    });
    if (left > 0.5) {
      const sid = `spay_${Date.now()}_${rnd()}`;
      tx.set(doc(db, 'supplier_payments', sid), { id: sid, providerId, providerName, amount: left, date, paidFrom: fund, locationId: loc, notes: 'Pago a cuenta', createdAtIso: iso, createdAt: ts() });
    }
  });
  return true;
}

export async function createProvider(name: string, phone: string) {
  const clean = name.trim();
  if (!clean) throw new UserError('Escribí el nombre del proveedor.');
  const id = `prov_${Date.now()}_${rnd()}`;
  const data: Record<string, any> = { name: clean, createdAt: ts(), updatedAt: ts() };
  if (phone.trim()) data.phone = phone.trim();
  await runWrite(() => setDoc(doc(db, 'providers', id), data));
  return id;
}

/* ============================ CAJA ============================ */
export async function createExpense(args: { category: string; description: string; amount: number; fund: Fund; loc: Loc }) {
  const { category, description, amount, fund, loc } = args;
  if (!(amount > 0)) throw new UserError('Ingresá el importe.');
  if (!description.trim()) throw new UserError('Escribí un detalle del gasto.');
  if (!fund) throw new UserError('Elegí de dónde salió la plata.');
  const id = `exp_${Date.now()}_${rnd()}`;
  return runWrite(() => setDoc(doc(db, 'expenses', id), {
    id, category, description: description.trim(), amount, date: getArgentinaToday(),
    paymentMethod: fund === 'mercado_pago' ? 'mercado_pago' : fund === 'transfer' ? 'transfer' : 'cash',
    paidFrom: fund, locationId: loc, notes: '', recurrent: false, createdAt: ts(), updatedAt: ts(),
  }));
}
export async function cancelExpense(id: string, reason: string) {
  if (!isOnline()) throw new UserError('Para anular un gasto hace falta conexión.');
  await expenseService.cancelExpense(id, reason || 'Anulado desde Caja');
  return true;
}
/** Indicar de dónde salió la plata de un gasto viejo que no lo tenía guardado. */
export async function setExpenseFund(id: string, fund: Fund) {
  await runWrite(() => updateDoc(doc(db, 'expenses', id), {
    paidFrom: fund, paymentMethod: fund === 'mercado_pago' ? 'mercado_pago' : fund === 'transfer' ? 'transfer' : 'cash', updatedAt: ts(),
  }));
}
/**
 * Ajustar saldo de caja general: guarda la diferencia entre lo que tenés de verdad y lo que dice la app
 * como movimiento manual "Ajuste de saldo" (efectivo de caja general y/o Mercado Pago general).
 * No es venta ni gasto: no cambia los reportes. Se puede anular.
 */
export async function adjustGeneralBalance(args: { realCash: number; appCash: number; realMp: number; appMp: number; note: string; loc: Loc }) {
  if (!isOnline()) throw new UserError('Para ajustar el saldo hace falta conexión.');
  const { realCash, appCash, realMp, appMp, loc } = args;
  if (!(realCash >= 0) || !(realMp >= 0)) throw new UserError('Ingresá los saldos reales (pueden ser 0).');
  const iso = nowIso(); const date = getArgentinaToday();
  const note = args.note.trim() || 'Ajuste para llevar el saldo a lo real';
  const b = writeBatch(db);
  let count = 0;
  const add = (diff: number, fund: 'caja_general' | 'mercado_pago', real: number, app: number) => {
    const amount = Math.round(diff * 100) / 100;
    if (Math.abs(amount) < 0.01) return;
    const id = `mov_adj_${Date.now()}_${rnd()}`;
    const docData: Record<string, any> = {
      id, type: amount > 0 ? 'INCOME' : 'EXPENSE', amount: Math.abs(amount), paymentMethod: fund === 'mercado_pago' ? 'mercado_pago' : 'cash',
      description: 'Ajuste de saldo (' + (fund === 'mercado_pago' ? 'Mercado Pago general' : 'efectivo de caja general') + ')',
      date, sourceType: 'MANUAL', sourceId: id, locationId: loc, paidFrom: fund, originFund: fund,
      notes: note + ' · la app decía ' + app.toFixed(2) + ', real ' + real.toFixed(2), adjustment: true, createdAtIso: iso, createdAt: ts(),
    };
    if (fund === 'caja_general') docData.cashRegisterType = 'caja_general'; // Firestore no acepta valores undefined
    b.set(doc(db, 'cash_movements', id), docData);
    count++;
  };
  add(realCash - appCash, 'caja_general', realCash, appCash);
  add(realMp - appMp, 'mercado_pago', realMp, appMp);
  if (!count) throw new UserError('Los saldos ya coinciden con lo que dice la app. No hay nada para ajustar.');
  await b.commit();
  return count;
}
/** Anular un movimiento manual (por ejemplo un ajuste de saldo cargado mal). */
export async function cancelManualMovement(id: string) {
  if (!isOnline()) throw new UserError('Para anular hace falta conexión.');
  await updateDoc(doc(db, 'cash_movements', id), { status: 'CANCELLED', cancelledAt: ts(), cancelledAtIso: nowIso(), cancellationReason: 'Anulado desde Caja general' });
  return true;
}

/** Asignar sucursal a un registro que quedó guardado con "Todas". */
export async function setRecordLocation(col: 'expenses' | 'cash_movements' | 'cash_closures', id: string, loc: Loc) {
  await runWrite(() => updateDoc(doc(db, col, id), { locationId: loc }));
}

/**
 * Cierre de caja: guarda el arqueo (efectivo y Mercado Pago) y pasa solo el efectivo contado a caja general.
 * El pase usa el mismo tipo de movimiento que ya usaba la app ("Pase de recaudación a Caja General").
 */
export async function closeCash(args: { loc: Loc; expectedCash: number; countedCash: number; expectedMp: number; countedMp: number; cashIn: number; mpIn: number; transferIn: number; notes: string }) {
  const { loc, expectedCash, countedCash, expectedMp, countedMp, notes } = args;
  if (!(countedCash >= 0)) throw new UserError('Ingresá el efectivo que contaste.');
  const iso = nowIso(); const date = getArgentinaToday();
  const closureId = `closure_${Date.now()}_${rnd()}`;
  const transferId = countedCash > 0 ? `mov_trans_gen_${Date.now()}_${rnd()}` : '';
  const b = writeBatch(db);
  const closure: Record<string, any> = {
    id: closureId, date, expectedCash, countedCash, difference: countedCash - expectedCash, locationId: loc, notes: notes.trim(),
    createdAtIso: iso, createdAt: ts(), cashCollected: args.cashIn, mercadoPagoCollected: args.mpIn, transferCollected: args.transferIn,
    totalCollected: args.cashIn + args.mpIn + args.transferIn, expectedMp, countedMp,
  };
  if (transferId) closure.autoTransferId = transferId;
  b.set(doc(db, 'cash_closures', closureId), closure);
  if (transferId) {
    b.set(doc(db, 'cash_movements', transferId), {
      id: transferId, type: 'EXPENSE', amount: countedCash, paymentMethod: 'cash', description: 'Pase de recaudación a Caja General (cierre de caja)',
      date, sourceType: 'INTERNAL_TRANSFER', sourceId: transferId, locationId: loc, originFund: 'caja_diaria', destinationFund: 'caja_general',
      cashRegisterType: 'caja_general', paidFrom: 'caja_diaria', closureId, notes: 'Pase automático al cerrar la caja', createdAtIso: iso, createdAt: ts(),
    });
  }
  return runWrite(() => b.commit());
}
export async function cancelClosure(closureId: string, transferId: string | undefined, reason: string) {
  if (!reason.trim()) throw new UserError('Escribí el motivo.');
  const iso = nowIso();
  const cancel = { status: 'CANCELLED', cancelledAt: ts(), cancelledAtIso: iso, cancellationReason: reason.trim() };
  const b = writeBatch(db);
  b.update(doc(db, 'cash_closures', closureId), cancel);
  if (transferId) b.update(doc(db, 'cash_movements', transferId), cancel);
  return runWrite(() => b.commit());
}
