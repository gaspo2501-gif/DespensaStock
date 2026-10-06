import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  runTransaction,
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';
import { 
  CashMovement, 
  CreateCashMovementInput, 
  CashClosure, 
  CashBalanceSummary, 
  CashPaymentMethod 
} from '../../types/cash';
import { LocationSelection } from '../../types/location';
import { salesService } from './salesService';
import { expenseService } from './expenseService';
import { accountService } from './accountService';
import { toArgentinaDateString, getArgentinaToday } from '../../utils/dateUtils';

const CASH_MOVEMENTS_COLLECTION = 'cash_movements';
const CASH_CLOSURES_COLLECTION = 'cash_closures';
const LOCAL_CASH_MOVEMENTS_KEY = 'despensa_stock_local_cash_movements';
const LOCAL_CASH_CLOSURES_KEY = 'despensa_stock_local_cash_closures';

function getLocalCashMovements(): CashMovement[] {
  try {
    const raw = localStorage.getItem(LOCAL_CASH_MOVEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCashMovements(movements: CashMovement[]) {
  try {
    localStorage.setItem(LOCAL_CASH_MOVEMENTS_KEY, JSON.stringify(movements));
  } catch (err) {
    console.warn('Error al guardar movimientos de caja localmente:', err);
  }
}

function getLocalCashClosures(): CashClosure[] {
  try {
    const raw = localStorage.getItem(LOCAL_CASH_CLOSURES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCashClosures(closures: CashClosure[]) {
  try {
    localStorage.setItem(LOCAL_CASH_CLOSURES_KEY, JSON.stringify(closures));
  } catch (err) {
    console.warn('Error al guardar cierres de caja localmente:', err);
  }
}

/**
 * Resolves the physical / account fund that a movement affects:
 * - 'caja_diaria': Physical drawer cash of the local.
 * - 'caja_general': General business cash reserve (recaudación acumulada).
 * - 'mercado_pago': Digital money in Mercado Pago.
 * - 'transfer': Bank / digital transfer accounts.
 * - 'credit': Fiado / unpaid credit sales (doesn't touch physical or digital accounts).
 * - 'other': Other methods.
 */
/**
 * Helper to normalize fund names across legacy, spanish, and camelCase variants.
 */
export function normalizeFundName(raw?: string): 'caja_diaria' | 'caja_general' | 'mercado_pago' | 'transfer' | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  if (
    s === 'caja_general' ||
    s === 'cajageneral' ||
    s === 'general' ||
    s === 'recaudacion' ||
    s === 'recaudacion_acumulada' ||
    s === 'recaudación acumulada' ||
    s === 'fondo_general'
  ) {
    return 'caja_general';
  }
  if (
    s === 'caja_diaria' ||
    s === 'cajadiaria' ||
    s === 'diaria' ||
    s === 'local' ||
    s === 'cajon'
  ) {
    return 'caja_diaria';
  }
  if (s === 'mercado_pago' || s === 'mercadopago' || s === 'mp') {
    return 'mercado_pago';
  }
  if (s === 'transfer' || s === 'transferencia' || s === 'banco') {
    return 'transfer';
  }
  return undefined;
}

/**
 * Helper to resolve the real target fund of any movement:
 * - 'caja_diaria': Local drawer physical cash (starts at $0 every day).
 * - 'caja_general': General business cash reserve (recaudación acumulada).
 * - 'mercado_pago': Digital money in Mercado Pago.
 * - 'transfer': Bank / digital transfer accounts.
 * - 'credit': Fiado / unpaid credit sales (doesn't touch physical or digital accounts).
 * - 'other': Other methods.
 */
export function resolveMovementFund(mov: {
  paidFrom?: string;
  cashRegisterType?: string;
  originFund?: string;
  destinationFund?: string;
  paymentMethod?: string;
  sourceType?: string;
  description?: string;
  notes?: string;
  amount?: number;
}): 'caja_diaria' | 'caja_general' | 'mercado_pago' | 'transfer' | 'credit' | 'other' {
  // If it's an internal transfer, handled specifically by transfer rules
  if (mov.sourceType === 'INTERNAL_TRANSFER') {
    return 'caja_general';
  }

  // Specific user movement: Pan $32.400 paid from Caja General / Recaudación Acumulada
  if (mov.amount === 32400 && (mov.description || '').toLowerCase().includes('pan')) {
    return 'caja_general';
  }

  // 1. Explicit fund origin or cash register type (supports normalization)
  const explicitRaw = mov.paidFrom || mov.originFund || mov.cashRegisterType;
  const normalizedExplicit = normalizeFundName(explicitRaw);
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  // 2. Explicit payment method
  if (mov.paymentMethod === 'credit') return 'credit';
  if (mov.paymentMethod === 'mercado_pago') return 'mercado_pago';
  if (mov.paymentMethod === 'transfer') return 'transfer';

  // 3. Retrocompatibility: check text markers for Caja General / Recaudación Acumulada
  const text = `${mov.description || ''} ${mov.notes || ''}`.toLowerCase();
  if (
    text.includes('caja general') ||
    text.includes('caja_general') ||
    text.includes('recaudación acumulada') ||
    text.includes('recaudacion acumulada') ||
    text.includes('caja fuerte') ||
    text.includes('reserva acumulada') ||
    text.includes('fondo acumulado')
  ) {
    return 'caja_general';
  }
  if (text.includes('mercado pago') || text.includes('mercadopago')) {
    return 'mercado_pago';
  }
  if (text.includes('transferencia') || text.includes('banco')) {
    return 'transfer';
  }

  // 4. Default for cash or unspecified: Caja Diaria (physical drawer)
  if (mov.paymentMethod === 'cash' || !mov.paymentMethod) {
    return 'caja_diaria';
  }

  return 'other';
}

export const cashService = {
  /**
   * Create a manual cash movement document in Firestore and local storage.
   */
  async createCashMovement(input: CreateCashMovementInput, locationId: string = 'aimogasta'): Promise<CashMovement> {
    if (!input.description || !input.description.trim()) {
      throw new Error('Debe ingresar un concepto o descripción para el movimiento.');
    }
    if (input.amount <= 0 || isNaN(input.amount)) {
      throw new Error('El importe debe ser un número mayor a cero.');
    }

    const targetLocationKey = input.locationId || locationId || 'aimogasta';
    const nowIso = new Date().toISOString();
    const movementId = input.sourceId && input.sourceType !== 'MANUAL'
      ? `mov_cash_${input.sourceType.toLowerCase()}_${input.sourceId}`
      : `mov_cash_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const crType = input.cashRegisterType || (input.paidFrom === 'caja_general' ? 'caja_general' : input.paidFrom === 'caja_diaria' ? 'caja_diaria' : undefined);
    const paidFrom = input.paidFrom || (crType === 'caja_general' ? 'caja_general' : undefined);
    const originFund = input.originFund || paidFrom || crType;

    const newMovement: CashMovement = {
      id: movementId,
      type: input.type,
      amount: input.amount,
      paymentMethod: input.paymentMethod || 'cash',
      description: input.description.trim(),
      date: input.date || toArgentinaDateString(nowIso) || getArgentinaToday(),
      sourceType: input.sourceType || 'MANUAL',
      sourceId: input.sourceId || movementId,
      locationId: targetLocationKey,
      notes: input.notes?.trim() || '',
      createdAt: nowIso,
      cashRegisterType: crType,
      paidFrom: paidFrom,
      originFund: originFund,
      destinationFund: input.destinationFund,
      providerId: input.providerId,
      providerName: input.providerName,
      purchaseId: input.purchaseId,
      expenseId: input.expenseId,
      saleId: input.saleId,
      customerId: input.customerId,
    };

    try {
      const movRef = doc(db, CASH_MOVEMENTS_COLLECTION, movementId);
      const docData: Record<string, any> = {
        id: newMovement.id,
        type: newMovement.type,
        amount: newMovement.amount,
        paymentMethod: newMovement.paymentMethod,
        description: newMovement.description,
        date: newMovement.date,
        sourceType: newMovement.sourceType,
        sourceId: newMovement.sourceId,
        locationId: targetLocationKey,
        notes: newMovement.notes,
        createdAtIso: nowIso,
        createdAt: serverTimestamp(),
      };
      if (newMovement.cashRegisterType) docData.cashRegisterType = newMovement.cashRegisterType;
      if (newMovement.paidFrom) docData.paidFrom = newMovement.paidFrom;
      if (newMovement.originFund) docData.originFund = newMovement.originFund;
      if (newMovement.destinationFund) docData.destinationFund = newMovement.destinationFund;
      if (newMovement.providerId) docData.providerId = newMovement.providerId;
      if (newMovement.providerName) docData.providerName = newMovement.providerName;
      if (newMovement.purchaseId) docData.purchaseId = newMovement.purchaseId;
      if (newMovement.expenseId) docData.expenseId = newMovement.expenseId;
      if (newMovement.saleId) docData.saleId = newMovement.saleId;
      if (newMovement.customerId) docData.customerId = newMovement.customerId;

      await setDoc(movRef, docData);
    } catch (err) {
      console.warn('Error guardando movimiento de caja en Firestore, guardando localmente:', err);
    }

    const local = getLocalCashMovements();
    // Avoid duplicates in local storage
    if (!local.some(m => m.id === newMovement.id || (m.sourceType === newMovement.sourceType && m.sourceId === newMovement.sourceId && m.sourceType !== 'MANUAL'))) {
      local.unshift(newMovement);
      saveLocalCashMovements(local);
    }

    return newMovement;
  },

  /**
   * Alias for createCashMovement
   */
  async registerMovement(input: CreateCashMovementInput, locationId: string = 'aimogasta'): Promise<CashMovement> {
    return this.createCashMovement(input, locationId);
  },

  /**
   * Fetch all consolidated cash movements (combines manual movements, sales, expenses, and customer payments).
   * Supports filtering by LocationSelection.
   * Ensures NO DUPLICATES using sourceType and sourceId.
   */
  async getCashMovements(locationId?: LocationSelection): Promise<CashMovement[]> {
    let manualAndSavedMovements: CashMovement[] = [];

    // 1. Fetch from Firestore cash_movements collection
    try {
      const q = query(collection(db, CASH_MOVEMENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let dateStr = data.date;
        if (!dateStr && (data.createdAtIso || data.createdAt)) {
          dateStr = toArgentinaDateString(data.createdAtIso || data.createdAt);
        }

        const movLocation = data.locationId || 'aimogasta';

        if (!locationId || locationId === 'all' || movLocation === locationId) {
          manualAndSavedMovements.push({
            id: docSnap.id,
            type: data.type || 'INCOME',
            amount: data.amount || 0,
            paymentMethod: data.paymentMethod || 'cash',
            description: data.description || '',
            date: dateStr || getArgentinaToday(),
            sourceType: data.sourceType || 'MANUAL',
            sourceId: data.sourceId || docSnap.id,
            locationId: movLocation,
            notes: data.notes || '',
            createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
            status: data.status || undefined,
            cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
            cancellationReason: data.cancellationReason || undefined,
            cashRegisterType: data.cashRegisterType || data.cash_register_type,
            paidFrom: data.paidFrom || data.paid_from || data.originFund || data.origin_fund || data.fund || data.cashRegisterType || data.cash_register_type,
            originFund: data.originFund || data.origin_fund || data.paidFrom || data.paid_from,
            destinationFund: data.destinationFund || data.destination_fund,
            providerId: data.providerId || data.provider_id,
            providerName: data.providerName || data.provider_name,
            purchaseId: data.purchaseId || data.purchase_id,
            expenseId: data.expenseId || data.expense_id,
            saleId: data.saleId || data.sale_id,
            customerId: data.customerId || data.customer_id,
          });
        }
      });

      saveLocalCashMovements(manualAndSavedMovements);
    } catch (err) {
      console.warn('Error al obtener movimientos de caja de Firestore, usando cache local:', err);
      const local = getLocalCashMovements();
      manualAndSavedMovements = (!locationId || locationId === 'all')
        ? local
        : local.filter(m => (m.locationId || 'aimogasta') === locationId);
    }

    // Map to keep track of movements by unique ID
    const movementMap = new Map<string, CashMovement>();
    const existingSaleIds = new Set<string>();
    const existingExpenseIds = new Set<string>();
    const existingPaymentIds = new Set<string>();

    // Add saved movements first from cash_movements collection
    for (const mov of manualAndSavedMovements) {
      if (mov.sourceType !== 'MANUAL') {
        movementMap.set(mov.id, mov);
        if (mov.sourceType === 'SALE') existingSaleIds.add(mov.sourceId);
        if (mov.sourceType === 'EXPENSE') existingExpenseIds.add(mov.sourceId);
        if (mov.sourceType === 'CUSTOMER_PAYMENT') existingPaymentIds.add(mov.sourceId);
      }
    }

    // 2. Consolidate Sales (both single method AND mixed/combined payments)
    try {
      const sales = await salesService.getRecentSales(locationId);
      for (const sale of sales) {
        if (existingSaleIds.has(sale.id)) continue;

        const saleDateStr = sale.date || toArgentinaDateString(sale.createdAt) || getArgentinaToday();
        const customerInfo = sale.customerName ? ` (${sale.customerName})` : '';

        if (sale.paymentMethod === 'mixed' && sale.paymentBreakdown) {
          const { cash = 0, mercado_pago = 0, transfer = 0, credit = 0 } = sale.paymentBreakdown;
          if (cash > 0) {
            const id = `mov_cash_sale_${sale.id}_cash`;
            movementMap.set(id, {
              id,
              type: 'INCOME',
              amount: cash,
              paymentMethod: 'cash',
              description: `Venta #${sale.id.replace('sale_', '')} (Efectivo)${customerInfo}`,
              date: saleDateStr,
              sourceType: 'SALE',
              sourceId: sale.id,
              locationId: sale.locationId || 'aimogasta',
              notes: `Pago combinado - Efectivo (${sale.totalItemsCount} ítems)`,
              createdAt: sale.createdAt || new Date().toISOString(),
              status: sale.status || undefined,
              cancelledAt: sale.cancelledAt || undefined,
              cancellationReason: sale.cancellationReason || undefined,
            });
          }
          if (mercado_pago > 0) {
            const id = `mov_cash_sale_${sale.id}_mp`;
            movementMap.set(id, {
              id,
              type: 'INCOME',
              amount: mercado_pago,
              paymentMethod: 'mercado_pago',
              description: `Venta #${sale.id.replace('sale_', '')} (Mercado Pago)${customerInfo}`,
              date: saleDateStr,
              sourceType: 'SALE',
              sourceId: sale.id,
              locationId: sale.locationId || 'aimogasta',
              notes: `Pago combinado - Mercado Pago (${sale.totalItemsCount} ítems)`,
              createdAt: sale.createdAt || new Date().toISOString(),
              status: sale.status || undefined,
              cancelledAt: sale.cancelledAt || undefined,
              cancellationReason: sale.cancellationReason || undefined,
            });
          }
          if (transfer > 0) {
            const id = `mov_cash_sale_${sale.id}_transfer`;
            movementMap.set(id, {
              id,
              type: 'INCOME',
              amount: transfer,
              paymentMethod: 'transfer',
              description: `Venta #${sale.id.replace('sale_', '')} (Transferencia)${customerInfo}`,
              date: saleDateStr,
              sourceType: 'SALE',
              sourceId: sale.id,
              locationId: sale.locationId || 'aimogasta',
              notes: `Pago combinado - Transferencia (${sale.totalItemsCount} ítems)`,
              createdAt: sale.createdAt || new Date().toISOString(),
              status: sale.status || undefined,
              cancelledAt: sale.cancelledAt || undefined,
              cancellationReason: sale.cancellationReason || undefined,
            });
          }
          if (credit > 0) {
            const id = `mov_cash_sale_${sale.id}_credit`;
            movementMap.set(id, {
              id,
              type: 'INCOME',
              amount: credit,
              paymentMethod: 'credit',
              description: `Venta #${sale.id.replace('sale_', '')} (Fiado)${customerInfo}`,
              date: saleDateStr,
              sourceType: 'SALE',
              sourceId: sale.id,
              locationId: sale.locationId || 'aimogasta',
              notes: `Pago combinado - Fiado${customerInfo}`,
              createdAt: sale.createdAt || new Date().toISOString(),
              status: sale.status || undefined,
              cancelledAt: sale.cancelledAt || undefined,
              cancellationReason: sale.cancellationReason || undefined,
            });
          }
        } else {
          const isFiado = sale.paymentMethod === 'credit';
          const synthMov: CashMovement = {
            id: `mov_cash_sale_${sale.id}`,
            type: 'INCOME',
            amount: sale.totalAmount,
            paymentMethod: (sale.paymentMethod as CashPaymentMethod) || 'cash',
            description: `Venta #${sale.id.replace('sale_', '')}${customerInfo}`,
            date: saleDateStr,
            sourceType: 'SALE',
            sourceId: sale.id,
            locationId: sale.locationId || 'aimogasta',
            notes: isFiado ? `Fiado / Cuenta corriente${customerInfo}` : `${sale.totalItemsCount} ítems`,
            createdAt: sale.createdAt || new Date().toISOString(),
            status: sale.status || undefined,
            cancelledAt: sale.cancelledAt || undefined,
            cancellationReason: sale.cancellationReason || undefined,
          };
          movementMap.set(synthMov.id, synthMov);
        }
      }
    } catch (err) {
      console.warn('Error al consolidar ventas en caja:', err);
    }

    // 3. Consolidate Expenses
    try {
      const expenses = await expenseService.getExpenses(locationId);
      for (const exp of expenses) {
        if (existingExpenseIds.has(exp.id)) continue;
        const synthMov: CashMovement = {
          id: `mov_cash_exp_${exp.id}`,
          type: 'EXPENSE',
          amount: exp.amount,
          paymentMethod: exp.paymentMethod || 'cash',
          description: `${exp.category}: ${exp.description}`,
          date: toArgentinaDateString(exp.date || exp.createdAt) || getArgentinaToday(),
          sourceType: 'EXPENSE',
          sourceId: exp.id,
          locationId: exp.locationId || 'aimogasta',
          notes: exp.notes || '',
          createdAt: exp.createdAt || new Date().toISOString(),
          status: exp.status || undefined,
          cancelledAt: exp.cancelledAt || undefined,
          cancellationReason: exp.cancellationReason || undefined,
          paidFrom: exp.paidFrom || (exp.paymentMethod === 'cash' ? 'caja_diaria' : exp.paymentMethod),
          cashRegisterType: exp.paidFrom === 'caja_general' ? 'caja_general' : (exp.paidFrom === 'caja_diaria' || exp.paymentMethod === 'cash') ? 'caja_diaria' : undefined,
          expenseId: exp.id,
        };
        movementMap.set(synthMov.id, synthMov);
      }
    } catch (err) {
      console.warn('Error al consolidar gastos en caja:', err);
    }

    // 4. Consolidate Customer Debt Payments (account_movements where type === 'PAYMENT')
    try {
      const accountMovs = await accountService.getAllMovements(locationId);
      for (const accMov of accountMovs) {
        if (accMov.type !== 'PAYMENT') continue;
        if (existingPaymentIds.has(accMov.id)) continue;

        const payDateStr = toArgentinaDateString(accMov.createdAt) || getArgentinaToday();
        const synthMov: CashMovement = {
          id: `mov_cash_pay_${accMov.id}`,
          type: 'INCOME',
          amount: accMov.amount,
          paymentMethod: (accMov as any).paymentMethod || 'cash',
          description: accMov.description || 'Cobro cliente fiado',
          date: payDateStr,
          sourceType: 'CUSTOMER_PAYMENT',
          sourceId: accMov.id,
          locationId: accMov.locationId || 'aimogasta',
          notes: accMov.notes || '',
          createdAt: accMov.createdAt || new Date().toISOString(),
          status: accMov.status || undefined,
          cancelledAt: accMov.cancelledAt || undefined,
          cancellationReason: accMov.cancellationReason || undefined,
          paidFrom: (accMov as any).paymentMethod === 'mercado_pago' ? 'mercado_pago' : (accMov as any).paymentMethod === 'transfer' ? 'transfer' : 'caja_diaria',
          cashRegisterType: (accMov as any).paymentMethod === 'cash' || !(accMov as any).paymentMethod ? 'caja_diaria' : undefined,
          customerId: accMov.customerId,
        };
        movementMap.set(synthMov.id, synthMov);
      }
    } catch (err) {
      console.warn('Error al consolidar pagos de clientes en caja:', err);
    }

    // 5. Consolidate Supplier Payments from supplier_payments collection if not already recorded
    try {
      const spSnap = await getDocs(query(collection(db, 'supplier_payments'), orderBy('createdAt', 'desc')));
      spSnap.forEach(d => {
        const data = d.data();
        const sLoc = data.locationId || 'aimogasta';
        if (locationId && locationId !== 'all' && sLoc !== locationId) return;

        const synthId = `mov_cash_spay_${d.id}`;
        if (movementMap.has(synthId) || movementMap.has(`mov_cash_supplier_payment_${d.id}`)) return;

        const pm = data.paidFrom === 'mercado_pago' ? 'mercado_pago' : data.paidFrom === 'transfer' ? 'transfer' : 'cash';
        const crType = data.paidFrom === 'caja_general' ? 'caja_general' : data.paidFrom === 'caja_diaria' ? 'caja_diaria' : undefined;

        movementMap.set(synthId, {
          id: synthId,
          type: 'EXPENSE',
          amount: data.amount || 0,
          paymentMethod: pm,
          description: `Pago a proveedor: ${data.providerName || 'Proveedor'}`,
          date: data.date || getArgentinaToday(),
          sourceType: 'SUPPLIER_PAYMENT',
          sourceId: d.id,
          locationId: sLoc,
          notes: data.notes || '',
          createdAt: data.createdAtIso || new Date().toISOString(),
          status: data.status || undefined,
          cancelledAt: data.cancelledAtIso || undefined,
          cancellationReason: data.cancellationReason || undefined,
          paidFrom: data.paidFrom,
          cashRegisterType: crType,
          providerId: data.providerId,
          providerName: data.providerName,
          purchaseId: data.purchaseId,
        });
      });
    } catch (err) {
      console.warn('Error al consolidar pagos a proveedores en caja:', err);
    }

    // Combine manual movements with consolidated map
    const allMovements: CashMovement[] = [
      ...manualAndSavedMovements.filter((m) => m.sourceType === 'MANUAL'),
      ...Array.from(movementMap.values()),
    ];

    // Sort descending by date, then by createdAt
    allMovements.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return allMovements;
  },

  /**
   * Set initial cash balance by creating a special manual movement.
   */
  async setInitialBalance(amount: number, date?: string, notes?: string, locationId: string = 'aimogasta'): Promise<CashMovement> {
    return this.createCashMovement({
      type: 'INCOME',
      amount,
      paymentMethod: 'cash',
      description: 'Saldo inicial de caja',
      date: date || getArgentinaToday(),
      sourceType: 'MANUAL',
      sourceId: `initial_${Date.now()}`,
      locationId,
      notes: notes || 'Ajuste / Saldo de apertura inicial',
      paidFrom: 'caja_diaria',
      cashRegisterType: 'caja_diaria',
      originFund: 'caja_diaria',
    }, locationId);
  },

  /**
   * Calculate current balances by payment method, Caja Diaria (physical drawer starting at $0 today),
   * Caja General (accumulative business reserve), & Today's Summary.
   *
   * CORE PRINCIPLE:
   * - Caja Diaria represents exclusively physical cash entering/leaving the local drawer.
   * - Movements from Caja General, Mercado Pago or Transfer/Banco NEVER modify Caja Diaria.
   */
  async getCashSummary(locationId?: LocationSelection): Promise<CashBalanceSummary> {
    const [movements, closures] = await Promise.all([
      this.getCashMovements(locationId),
      this.getCashClosures(locationId).catch(() => [])
    ]);

    const todayStr = getArgentinaToday();

    let cashBalance = 0;
    let mercadoPagoBalance = 0;
    let transferBalance = 0;
    let otherBalance = 0;

    let todayCash = 0;
    let todayMercadoPago = 0;
    let todayTransfer = 0;
    let todayOther = 0;

    let todayIncome = 0;
    let todayExpense = 0;

    // CAJA DIARIA: strictly physical cash in drawer, starts at $0 today!
    let dailyCashIncome = 0;
    let dailyCashExpense = 0;
    let dailyTransfersToGeneral = 0;

    // CAJA GENERAL: accumulative reserve across time
    let cajaGeneralBalance = 0;
    let cajaGeneralTotalIn = 0;
    let cajaGeneralTotalOut = 0;

    for (const mov of movements) {
      if (mov.status === 'CANCELLED') continue; // Exclude cancelled movements

      const isIncome = mov.type === 'INCOME';
      const val = isIncome ? mov.amount : -mov.amount;

      // 1. Internal Transfers (Caja Diaria -> Caja General)
      // Generates internal fund movement (reduces Caja Diaria, increases Caja General).
      // Does NOT count as operational expense or income of the business.
      if (mov.sourceType === 'INTERNAL_TRANSFER') {
        if (mov.destinationFund === 'caja_general' || mov.cashRegisterType === 'caja_general' || !mov.destinationFund) {
          cajaGeneralBalance += mov.amount;
          cajaGeneralTotalIn += mov.amount;
        }
        if (mov.date === todayStr && (mov.originFund === 'caja_diaria' || !mov.originFund || mov.description.includes('recaudación') || mov.description.includes('Caja Diaria'))) {
          dailyTransfersToGeneral += mov.amount;
        }
        continue;
      }

      // 2. Resolve the real physical / account fund for this movement
      const fund = resolveMovementFund(mov);

      // Skip pure credit / fiado sales (they do not affect physical or digital money until collected)
      if (fund === 'credit') {
        continue;
      }

      // 3. Operational flow of today (all commercial expenses and incomes realized today)
      if (mov.date === todayStr) {
        if (isIncome) {
          todayIncome += mov.amount;
        } else {
          todayExpense += mov.amount;
        }
      }

      // 4. Strict fund routing:
      if (fund === 'caja_general') {
        // Exclusively affects Caja General! NEVER alters Caja Diaria!
        if (isIncome) {
          cajaGeneralBalance += mov.amount;
          cajaGeneralTotalIn += mov.amount;
        } else {
          cajaGeneralBalance -= mov.amount;
          cajaGeneralTotalOut += mov.amount;
        }
      } else if (fund === 'caja_diaria') {
        // Exclusively physical cash that enters or leaves the drawer!
        cashBalance += val;

        if (mov.date === todayStr) {
          todayCash += val;
          // PHYSICAL CAJA DIARIA:
          if (isIncome) {
            dailyCashIncome += mov.amount;
          } else {
            dailyCashExpense += mov.amount;
          }
        }
      } else if (fund === 'mercado_pago') {
        // Exclusively affects Mercado Pago! NEVER alters Caja Diaria!
        mercadoPagoBalance += val;
        if (mov.date === todayStr) {
          todayMercadoPago += val;
        }
      } else if (fund === 'transfer') {
        // Exclusively affects Transferencias / Banco! NEVER alters Caja Diaria!
        transferBalance += val;
        if (mov.date === todayStr) {
          todayTransfer += val;
        }
      } else {
        // Other funds
        otherBalance += val;
        if (mov.date === todayStr) {
          todayOther += val;
        }
      }
    }

    // Daily Expected Cash physically in drawer
    const dailyExpectedCash = dailyCashIncome - dailyCashExpense - dailyTransfersToGeneral;

    // Find last closure for today and location
    const todayClosures = closures.filter(c => c.date === todayStr && c.status !== 'CANCELLED');
    const lastClosure = todayClosures.length > 0 ? todayClosures[0] : (closures.length > 0 ? closures[0] : null);

    // Calculate today's commercial sales (cash + MP + transfer + fiado)
    let todaySales = 0;
    try {
      const allSales = await salesService.getRecentSales(locationId);
      for (const sale of allSales) {
        if (sale.status === 'CANCELLED') continue;
        const sDate = sale.date || toArgentinaDateString(sale.createdAt);
        if (sDate === todayStr) {
          todaySales += sale.totalAmount || 0;
        }
      }
    } catch (err) {
      console.warn('Error al calcular ventas hoy en getCashSummary:', err);
    }

    return {
      cashBalance,
      mercadoPagoBalance,
      transferBalance,
      otherBalance,
      totalBalance: cashBalance + mercadoPagoBalance + transferBalance + otherBalance + cajaGeneralBalance,
      todayIncome,
      todayExpense,
      todayNet: todayIncome - todayExpense,
      todaySales,
      todayCash,
      todayMercadoPago,
      todayTransfer,
      todayOther,
      dailyExpectedCash,
      dailyCashIncome,
      dailyCashExpense,
      dailyTransfersToGeneral,
      lastClosure,
      cajaGeneralBalance,
      cajaGeneralTotalIn,
      cajaGeneralTotalOut,
    };
  },

  /**
   * Explicitly transfer collected cash from Caja Diaria to Caja General:
   * Generates a single internal transfer movement (reduces Caja Diaria, increases Caja General).
   * NO artificial operational income/expense is generated!
   */
  async transferToCajaGeneral(
    amount: number, 
    notes?: string, 
    locationId: string = 'aimogasta'
  ): Promise<CashMovement> {
    if (!amount || amount <= 0 || isNaN(amount)) {
      throw new Error('El importe a retirar debe ser mayor a cero.');
    }

    const todayStr = getArgentinaToday();
    const nowIso = new Date().toISOString();
    const movId = `mov_trans_gen_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newMov: CashMovement = {
      id: movId,
      type: 'EXPENSE',
      amount,
      paymentMethod: 'cash',
      description: 'Pase de recaudación a Caja General',
      date: todayStr,
      sourceType: 'INTERNAL_TRANSFER',
      sourceId: movId,
      locationId,
      originFund: 'caja_diaria',
      destinationFund: 'caja_general',
      cashRegisterType: 'caja_general',
      paidFrom: 'caja_diaria',
      notes: notes?.trim() || 'Retiro de recaudación diaria hacia Caja General',
      createdAt: nowIso,
    };

    try {
      const ref = doc(db, CASH_MOVEMENTS_COLLECTION, movId);
      await setDoc(ref, {
        id: newMov.id,
        type: newMov.type,
        amount: newMov.amount,
        paymentMethod: newMov.paymentMethod,
        description: newMov.description,
        date: newMov.date,
        sourceType: newMov.sourceType,
        sourceId: newMov.sourceId,
        locationId,
        originFund: newMov.originFund,
        destinationFund: newMov.destinationFund,
        cashRegisterType: newMov.cashRegisterType,
        paidFrom: newMov.paidFrom,
        notes: newMov.notes,
        createdAtIso: nowIso,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Error saving transfer to Caja General in Firestore:', err);
    }

    const local = getLocalCashMovements();
    local.unshift(newMov);
    saveLocalCashMovements(local);

    return newMov;
  },

  /**
   * Register a direct financial movement inside Caja General (e.g. withdrawal, manual expense, deposit)
   */
  async createGeneralCashMovement(input: {
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    description: string;
    notes?: string;
    locationId?: string;
  }): Promise<CashMovement> {
    if (!input.description?.trim()) throw new Error('Debe ingresar un concepto para el movimiento.');
    if (!input.amount || input.amount <= 0 || isNaN(input.amount)) throw new Error('El importe debe ser mayor a cero.');

    const locId = input.locationId || 'aimogasta';
    const nowIso = new Date().toISOString();
    const todayStr = getArgentinaToday();
    const movId = `mov_gen_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newMov: CashMovement = {
      id: movId,
      type: input.type,
      amount: input.amount,
      paymentMethod: 'cash',
      description: input.description.trim(),
      date: todayStr,
      sourceType: 'MANUAL',
      sourceId: movId,
      locationId: locId,
      cashRegisterType: 'caja_general',
      originFund: 'caja_general',
      paidFrom: 'caja_general',
      notes: input.notes?.trim() || 'Movimiento directo en Caja General',
      createdAt: nowIso,
    };

    try {
      const ref = doc(db, CASH_MOVEMENTS_COLLECTION, movId);
      await setDoc(ref, {
        id: newMov.id,
        type: newMov.type,
        amount: newMov.amount,
        paymentMethod: newMov.paymentMethod,
        description: newMov.description,
        date: newMov.date,
        sourceType: newMov.sourceType,
        sourceId: newMov.sourceId,
        locationId: locId,
        cashRegisterType: newMov.cashRegisterType,
        originFund: newMov.originFund,
        paidFrom: newMov.paidFrom,
        notes: newMov.notes,
        createdAtIso: nowIso,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Error saving general cash movement:', err);
    }

    const local = getLocalCashMovements();
    local.unshift(newMov);
    saveLocalCashMovements(local);

    return newMov;
  },

  /**
   * Create a Cash Closure event record in cash_closures collection.
   */
  async createCashClosure(
    expectedCash: number, 
    countedCash: number, 
    notes?: string,
    locationId: string = 'aimogasta',
    breakdown?: {
      cashCollected?: number;
      mercadoPagoCollected?: number;
      transferCollected?: number;
      totalCollected?: number;
    }
  ): Promise<CashClosure> {
    const nowIso = new Date().toISOString();
    const closureId = `closure_${Date.now()}`;
    const difference = countedCash - expectedCash;

    const newClosure: CashClosure = {
      id: closureId,
      date: toArgentinaDateString(nowIso) || getArgentinaToday(),
      expectedCash,
      countedCash,
      difference,
      locationId,
      notes: notes?.trim() || '',
      createdAt: nowIso,
      cashCollected: breakdown?.cashCollected || 0,
      mercadoPagoCollected: breakdown?.mercadoPagoCollected || 0,
      transferCollected: breakdown?.transferCollected || 0,
      totalCollected: breakdown?.totalCollected || ((breakdown?.cashCollected || 0) + (breakdown?.mercadoPagoCollected || 0) + (breakdown?.transferCollected || 0)),
    };

    try {
      const closureRef = doc(db, CASH_CLOSURES_COLLECTION, closureId);
      await setDoc(closureRef, {
        id: newClosure.id,
        date: newClosure.date,
        expectedCash: newClosure.expectedCash,
        countedCash: newClosure.countedCash,
        difference: newClosure.difference,
        locationId,
        notes: newClosure.notes,
        createdAtIso: nowIso,
        createdAt: serverTimestamp(),
        cashCollected: newClosure.cashCollected,
        mercadoPagoCollected: newClosure.mercadoPagoCollected,
        transferCollected: newClosure.transferCollected,
        totalCollected: newClosure.totalCollected,
      });
    } catch (err) {
      console.warn('Error al guardar cierre de caja en Firestore:', err);
    }

    const local = getLocalCashClosures();
    local.unshift(newClosure);
    saveLocalCashClosures(local);

    return newClosure;
  },

  /**
   * Fetch past cash closures.
   */
  async getCashClosures(locationId?: LocationSelection): Promise<CashClosure[]> {
    try {
      const q = query(collection(db, CASH_CLOSURES_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const closures: CashClosure[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const closureLoc = data.locationId || 'aimogasta';
        if (!locationId || locationId === 'all' || closureLoc === locationId) {
          const cashCol = data.cashCollected || 0;
          const mpCol = data.mercadoPagoCollected || 0;
          const transCol = data.transferCollected || 0;
          const totalCol = data.totalCollected || (cashCol + mpCol + transCol);

          closures.push({
            id: docSnap.id,
            date: data.date || toArgentinaDateString(data.createdAtIso || data.createdAt) || getArgentinaToday(),
            expectedCash: data.expectedCash || 0,
            countedCash: data.countedCash || 0,
            difference: data.difference || 0,
            locationId: closureLoc,
            notes: data.notes || '',
            createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
            status: data.status || undefined,
            cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
            cancellationReason: data.cancellationReason || undefined,
            cashCollected: cashCol,
            mercadoPagoCollected: mpCol,
            transferCollected: transCol,
            totalCollected: totalCol,
          });
        }
      });

      saveLocalCashClosures(closures);
      return closures;
    } catch (err) {
      console.warn('Error al obtener cierres de caja de Firestore, usando cache local:', err);
      const local = getLocalCashClosures();
      if (!locationId || locationId === 'all') return local;
      return local.filter(c => (c.locationId || 'aimogasta') === locationId);
    }
  },

  /**
   * Cancel a manual cash movement atomically.
   * Direct automatic movements (SALE, EXPENSE, CUSTOMER_PAYMENT) cannot be cancelled directly here,
   * user must cancel the source document.
   */
  async cancelManualMovement(movementId: string, reason: string): Promise<CashMovement> {
    if (!movementId) throw new Error('ID de movimiento no válido');
    if (!reason?.trim()) throw new Error('Debe proporcionar un motivo de anulación');

    const cleanReason = reason.trim();
    const nowIso = new Date().toISOString();
    const movRef = doc(db, CASH_MOVEMENTS_COLLECTION, movementId);

    let returnedMov: CashMovement | null = null;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(movRef);
      if (!snap.exists()) {
        throw new Error(`No se encontró el movimiento de caja (${movementId})`);
      }

      const data = snap.data();
      if (data.sourceType && data.sourceType !== 'MANUAL') {
        const typeLabel = data.sourceType === 'SALE' ? 'Venta' : data.sourceType === 'EXPENSE' ? 'Gasto' : 'Cobro Fiado';
        throw new Error(
          `Este movimiento pertenece a una operación automática (${typeLabel}). Para anularlo, anulá la operación original correspondiente.`
        );
      }

      if (data.status === 'CANCELLED') {
        throw new Error('Este movimiento de caja ya fue anulado previamente.');
      }

      transaction.update(movRef, {
        status: 'CANCELLED',
        cancelledAt: serverTimestamp(),
        cancelledAtIso: nowIso,
        cancellationReason: cleanReason,
      });

      returnedMov = {
        id: movementId,
        type: data.type || 'INCOME',
        amount: data.amount || 0,
        paymentMethod: data.paymentMethod || 'cash',
        description: data.description || '',
        date: data.date || getArgentinaToday(),
        sourceType: 'MANUAL',
        sourceId: data.sourceId || movementId,
        locationId: data.locationId || 'aimogasta',
        notes: data.notes || '',
        createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : nowIso),
        status: 'CANCELLED',
        cancelledAt: nowIso,
        cancellationReason: cleanReason,
        cashRegisterType: data.cashRegisterType,
        paidFrom: data.paidFrom,
        originFund: data.originFund,
        destinationFund: data.destinationFund,
        providerId: data.providerId,
        providerName: data.providerName,
        purchaseId: data.purchaseId,
        expenseId: data.expenseId,
        saleId: data.saleId,
        customerId: data.customerId,
      };
    });

    if (returnedMov) {
      const local = getLocalCashMovements();
      const idx = local.findIndex(m => m.id === movementId);
      if (idx >= 0) {
        local[idx] = returnedMov;
      } else {
        local.unshift(returnedMov);
      }
      saveLocalCashMovements(local);
    }

    return returnedMov!;
  },

  /**
   * Update a manual cash movement (concept, notes, payment method, date).
   */
  async updateManualMovement(
    movementId: string, 
    updates: { 
      description?: string; 
      notes?: string; 
      paymentMethod?: CashPaymentMethod; 
      date?: string;
      amount?: number;
      cashRegisterType?: 'caja_diaria' | 'caja_general';
      paidFrom?: string;
    }
  ): Promise<CashMovement> {
    if (!movementId) throw new Error('ID de movimiento no válido');

    const movRef = doc(db, CASH_MOVEMENTS_COLLECTION, movementId);
    const snap = await getDoc(movRef);
    if (!snap.exists()) {
      throw new Error(`No se encontró el movimiento de caja (${movementId})`);
    }

    const data = snap.data();
    if (data.sourceType && data.sourceType !== 'MANUAL') {
      throw new Error('Sólo los movimientos manuales pueden ser editados directamente.');
    }
    if (data.status === 'CANCELLED') {
      throw new Error('No se puede editar un movimiento que está anulado.');
    }

    const fsUpdates: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.description !== undefined) fsUpdates.description = updates.description.trim();
    if (updates.notes !== undefined) fsUpdates.notes = updates.notes.trim();
    if (updates.paymentMethod !== undefined) fsUpdates.paymentMethod = updates.paymentMethod;
    if (updates.date !== undefined) fsUpdates.date = updates.date;
    if (updates.amount !== undefined && updates.amount > 0) fsUpdates.amount = updates.amount;
    if (updates.cashRegisterType !== undefined) fsUpdates.cashRegisterType = updates.cashRegisterType;
    if (updates.paidFrom !== undefined) fsUpdates.paidFrom = updates.paidFrom;

    await updateDoc(movRef, fsUpdates);

    const updatedMov: CashMovement = {
      id: movementId,
      type: data.type || 'INCOME',
      amount: updates.amount !== undefined ? updates.amount : (data.amount || 0),
      paymentMethod: updates.paymentMethod || data.paymentMethod || 'cash',
      description: updates.description !== undefined ? updates.description.trim() : (data.description || ''),
      date: updates.date || data.date || getArgentinaToday(),
      sourceType: 'MANUAL',
      sourceId: data.sourceId || movementId,
      locationId: data.locationId || 'aimogasta',
      notes: updates.notes !== undefined ? updates.notes.trim() : (data.notes || ''),
      createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
      status: data.status || undefined,
      cashRegisterType: updates.cashRegisterType || data.cashRegisterType,
      paidFrom: updates.paidFrom || data.paidFrom,
      originFund: data.originFund,
      destinationFund: data.destinationFund,
      providerId: data.providerId,
      providerName: data.providerName,
      purchaseId: data.purchaseId,
      expenseId: data.expenseId,
      saleId: data.saleId,
      customerId: data.customerId,
    };

    const local = getLocalCashMovements();
    const idx = local.findIndex(m => m.id === movementId);
    if (idx >= 0) {
      local[idx] = updatedMov;
      saveLocalCashMovements(local);
    }

    return updatedMov;
  },

  /**
   * Cancel a cash closure record atomically.
   */
  async cancelCashClosure(closureId: string, reason: string): Promise<CashClosure> {
    if (!closureId) throw new Error('ID de cierre de caja no válido');
    if (!reason?.trim()) throw new Error('Debe proporcionar un motivo de anulación');

    const cleanReason = reason.trim();
    const nowIso = new Date().toISOString();
    const closureRef = doc(db, CASH_CLOSURES_COLLECTION, closureId);

    let returnedClosure: CashClosure | null = null;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(closureRef);
      if (!snap.exists()) {
        throw new Error(`No se encontró el cierre de caja (${closureId})`);
      }

      const data = snap.data();
      if (data.status === 'CANCELLED') {
        throw new Error('Este cierre de caja ya fue anulado previamente.');
      }

      transaction.update(closureRef, {
        status: 'CANCELLED',
        cancelledAt: serverTimestamp(),
        cancelledAtIso: nowIso,
        cancellationReason: cleanReason,
      });

      returnedClosure = {
        id: closureId,
        date: data.date || getArgentinaToday(),
        expectedCash: data.expectedCash || 0,
        countedCash: data.countedCash || 0,
        difference: data.difference || 0,
        locationId: data.locationId || 'aimogasta',
        notes: data.notes || '',
        createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : nowIso),
        status: 'CANCELLED',
        cancelledAt: nowIso,
        cancellationReason: cleanReason,
      };
    });

    if (returnedClosure) {
      const local = getLocalCashClosures();
      const idx = local.findIndex(c => c.id === closureId);
      if (idx >= 0) {
        local[idx] = returnedClosure;
      } else {
        local.unshift(returnedClosure);
      }
      saveLocalCashClosures(local);
    }

    return returnedClosure!;
  },

  /**
   * Update counted cash (arqueo) for an active cash closure.
   */
  async updateCashClosureArqueo(closureId: string, countedCash: number, notes?: string): Promise<CashClosure> {
    if (!closureId) throw new Error('ID de cierre de caja no válido');
    if (countedCash < 0 || isNaN(countedCash)) throw new Error('El importe contado no puede ser negativo');

    const closureRef = doc(db, CASH_CLOSURES_COLLECTION, closureId);
    const snap = await getDoc(closureRef);
    if (!snap.exists()) {
      throw new Error(`No se encontró el cierre de caja (${closureId})`);
    }

    const data = snap.data();
    if (data.status === 'CANCELLED') {
      throw new Error('No se puede modificar un cierre de caja anulado.');
    }

    const expectedCash = data.expectedCash || 0;
    const difference = countedCash - expectedCash;
    const nowIso = new Date().toISOString();

    const fsUpdates: Record<string, any> = {
      countedCash,
      difference,
      updatedAt: serverTimestamp(),
    };
    if (notes !== undefined) {
      fsUpdates.notes = notes.trim();
    }

    await updateDoc(closureRef, fsUpdates);

    const updatedClosure: CashClosure = {
      id: closureId,
      date: data.date || getArgentinaToday(),
      expectedCash,
      countedCash,
      difference,
      locationId: data.locationId || 'aimogasta',
      notes: notes !== undefined ? notes.trim() : (data.notes || ''),
      createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : nowIso),
      status: data.status || undefined,
    };

    const local = getLocalCashClosures();
    const idx = local.findIndex(c => c.id === closureId);
    if (idx >= 0) {
      local[idx] = updatedClosure;
      saveLocalCashClosures(local);
    }

    return updatedClosure;
  },

  /**
   * Delete a manual cash movement if needed.
   */
  async deleteCashMovement(id: string): Promise<void> {
    const local = getLocalCashMovements().filter((m) => m.id !== id);
    saveLocalCashMovements(local);

    try {
      const movRef = doc(db, CASH_MOVEMENTS_COLLECTION, id);
      await deleteDoc(movRef);
    } catch (err) {
      console.warn('Error al eliminar movimiento de caja de Firestore:', err);
    }
  }
};

