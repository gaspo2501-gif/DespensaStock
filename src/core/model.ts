/**
 * Modelo normalizado de DespensaStock (v2).
 *
 * IMPORTANTE: estos tipos describen cómo la app LEE los documentos que ya existen en Firestore.
 * No cambian el formato guardado. Los campos nuevos (minStockAlert, archived, unitCost en ítems
 * de venta, margin en ítems de compra, expectedMp/countedMp/autoTransferId en cierres, closureId
 * en pases a caja general) son opcionales y aditivos: los registros viejos siguen siendo válidos.
 */

export type Loc = 'aimogasta' | 'olascoaga';
export const LOCS: Record<Loc, string> = { aimogasta: 'Aimogasta', olascoaga: 'Olascoaga' };
export const LOC_IDS: Loc[] = ['aimogasta', 'olascoaga'];
export const otherLoc = (l: Loc): Loc => (l === 'aimogasta' ? 'olascoaga' : 'aimogasta');

/** Fondos donde puede estar la plata. Mismos valores que ya usa la app (paidFrom). */
export type Fund = 'caja_diaria' | 'caja_general' | 'mercado_pago' | 'transfer' | 'other';
export const FUND_LABEL: Record<Fund, string> = {
  caja_diaria: 'Efectivo del cajón',
  caja_general: 'Efectivo de caja general',
  mercado_pago: 'Mercado Pago',
  transfer: 'Transferencia',
  other: 'Otro',
};
/** Fondos que se ofrecen al cargar un gasto o un pago. */
export const PAY_FUNDS: Fund[] = ['caja_diaria', 'caja_general', 'mercado_pago'];

export type Status = 'ACTIVE' | 'CANCELLED';

export interface Pay { cash: number; mp: number; transfer: number; credit: number }
export const emptyPay = (): Pay => ({ cash: 0, mp: 0, transfer: 0, credit: 0 });

export const DEFAULT_MIN_STOCK = 3;
export const MARGINS = [25, 30, 35, 40];
export const DEFAULT_MARGIN = 40;

export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  presentation: string;
  description: string;
  imageUrl: string;
  price?: number;
  cost?: number;
  stock: Record<Loc, number>;
  /** true si el documento ya tiene stockByLocation con las dos sucursales (permite sumar/restar en forma atómica). */
  hasMap: boolean;
  min: number;
  minIsDefault: boolean;
  archived: boolean;
  lastSupplierName?: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  barcode: string;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  unitCost?: number;
}

export interface Sale {
  id: string;
  date: string;
  time: string;
  createdAt: string;
  loc: Loc;
  items: SaleItem[];
  total: number;
  method: string;
  pay: Pay;
  customerId?: string;
  customerName?: string;
  status: Status;
  cancellationReason?: string;
  /** Correcciones de forma de pago hechas después de la venta. */
  paymentChanges?: { at: string; reason: string }[];
}

export interface AccMov {
  id: string;
  customerId: string;
  type: 'DEBT' | 'PAYMENT';
  amount: number;
  date: string;
  time: string;
  createdAt: string;
  loc: Loc;
  pay: Pay; // solo para PAYMENT
  saleId?: string;
  description: string;
  status: Status;
}

export interface Customer { id: string; name: string; phone: string; notes: string }
export interface Provider { id: string; name: string; phone: string }

export interface Expense {
  id: string;
  date: string;
  createdAt: string;
  loc: Loc;
  category: string;
  description: string;
  amount: number;
  fund: Fund;
  /** false cuando el registro viejo no guardó de dónde salió la plata y la app lo supone. */
  fundExplicit: boolean;
  status: Status;
  rawLocation?: string;
}

export interface SupplierPayment {
  id: string;
  providerId: string;
  providerName: string;
  purchaseId?: string;
  amount: number;
  date: string;
  createdAt: string;
  loc: Loc;
  fund: Fund;
  status: Status;
}

export interface Purchase {
  id: string;
  date: string;
  createdAt: string;
  loc: Loc;
  providerId: string;
  providerName: string;
  total: number;
  paidAmount: number;
  itemsCount: number;
  status: Status;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  name: string;
  qty: number;
  unitCost: number;
  previousCost?: number;
  finalSalePrice: number;
  margin?: number;
  status: Status;
}

/** Movimientos de caja_movements que NO se derivan de otro documento: manuales y pases a caja general. */
export interface CashMov {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  sourceType: 'MANUAL' | 'INTERNAL_TRANSFER';
  amount: number;
  date: string;
  time: string;
  createdAt: string;
  loc: Loc;
  fund: Fund;
  description: string;
  closureId?: string;
  status: Status;
  rawLocation?: string;
}

export interface Closure {
  id: string;
  date: string;
  time: string;
  createdAt: string;
  loc: Loc;
  expectedCash: number;
  countedCash: number;
  expectedMp?: number;
  countedMp?: number;
  autoTransferId?: string;
  notes: string;
  status: Status;
  rawLocation?: string;
}

export interface DataState {
  products: Product[];
  customers: Customer[];
  providers: Provider[];
  sales: Sale[];
  acc: AccMov[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  spays: SupplierPayment[];
  expenses: Expense[];
  cashMovs: CashMov[];
  closures: Closure[];
}

export const emptyData = (): DataState => ({
  products: [], customers: [], providers: [], sales: [], acc: [], purchases: [], purchaseItems: [],
  spays: [], expenses: [], cashMovs: [], closures: [],
});
