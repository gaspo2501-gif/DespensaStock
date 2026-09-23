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
    };

    try {
      const movRef = doc(db, CASH_MOVEMENTS_COLLECTION, movementId);
      await setDoc(movRef, {
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
      });
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

    // Map to keep track of existing movements by sourceType + sourceId
    const movementMap = new Map<string, CashMovement>();

    // Key function for source uniqueness
    const getSourceKey = (sourceType: string, sourceId: string) => `${sourceType}_${sourceId}`;

    // Add saved movements first
    for (const mov of manualAndSavedMovements) {
      if (mov.sourceType !== 'MANUAL') {
        movementMap.set(getSourceKey(mov.sourceType, mov.sourceId), mov);
      }
    }

    // 2. Consolidate non-fiado Sales (paymentMethod !== 'credit')
    try {
      const sales = await salesService.getRecentSales(locationId);
      for (const sale of sales) {
        if (sale.paymentMethod === 'credit') continue; // Fiado sales do NOT generate cash income

        const key = getSourceKey('SALE', sale.id);
        if (!movementMap.has(key)) {
          const saleDateStr = toArgentinaDateString(sale.createdAt) || getArgentinaToday();
          const synthMov: CashMovement = {
            id: `mov_cash_sale_${sale.id}`,
            type: 'INCOME',
            amount: sale.totalAmount,
            paymentMethod: (sale.paymentMethod as CashPaymentMethod) || 'cash',
            description: `Venta #${sale.id.replace('sale_', '')}`,
            date: saleDateStr,
            sourceType: 'SALE',
            sourceId: sale.id,
            locationId: sale.locationId || 'aimogasta',
            notes: `${sale.totalItemsCount} ítems`,
            createdAt: sale.createdAt || new Date().toISOString(),
            status: sale.status || undefined,
            cancelledAt: sale.cancelledAt || undefined,
            cancellationReason: sale.cancellationReason || undefined,
          };
          movementMap.set(key, synthMov);
        }
      }
    } catch (err) {
      console.warn('Error al consolidar ventas en caja:', err);
    }

    // 3. Consolidate Expenses
    try {
      const expenses = await expenseService.getExpenses(locationId);
      for (const exp of expenses) {
        const key = getSourceKey('EXPENSE', exp.id);
        if (!movementMap.has(key)) {
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
          };
          movementMap.set(key, synthMov);
        }
      }
    } catch (err) {
      console.warn('Error al consolidar gastos en caja:', err);
    }

    // 4. Consolidate Customer Debt Payments (account_movements where type === 'PAYMENT')
    try {
      const accountMovs = await accountService.getAllMovements(locationId);
      for (const accMov of accountMovs) {
        if (accMov.type !== 'PAYMENT') continue;

        const key = getSourceKey('CUSTOMER_PAYMENT', accMov.id);
        if (!movementMap.has(key)) {
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
          };
          movementMap.set(key, synthMov);
        }
      }
    } catch (err) {
      console.warn('Error al consolidar pagos de clientes en caja:', err);
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
    }, locationId);
  },

  /**
   * Calculate current balances by payment method (Cash, Mercado Pago, Transfer) & Today's Summary.
   */
  async getCashSummary(locationId?: LocationSelection): Promise<CashBalanceSummary> {
    const movements = await this.getCashMovements(locationId);

    const todayStr = getArgentinaToday();

    let cashBalance = 0;
    let mercadoPagoBalance = 0;
    let transferBalance = 0;
    let otherBalance = 0;

    let todayIncome = 0;
    let todayExpense = 0;

    for (const mov of movements) {
      if (mov.status === 'CANCELLED') continue; // Exclude cancelled movements from cash balances and totals
      const isIncome = mov.type === 'INCOME';
      const val = isIncome ? mov.amount : -mov.amount;

      // Accumulate totals by payment method
      if (mov.paymentMethod === 'cash') {
        cashBalance += val;
      } else if (mov.paymentMethod === 'mercado_pago') {
        mercadoPagoBalance += val;
      } else if (mov.paymentMethod === 'transfer') {
        transferBalance += val;
      } else {
        otherBalance += val;
      }

      // Today's summary
      if (mov.date === todayStr) {
        if (isIncome) {
          todayIncome += mov.amount;
        } else {
          todayExpense += mov.amount;
        }
      }
    }

    return {
      cashBalance,
      mercadoPagoBalance,
      transferBalance,
      otherBalance,
      totalBalance: cashBalance + mercadoPagoBalance + transferBalance + otherBalance,
      todayIncome,
      todayExpense,
      todayNet: todayIncome - todayExpense,
    };
  },

  /**
   * Create a Cash Closure event record in cash_closures collection.
   */
  async createCashClosure(
    expectedCash: number, 
    countedCash: number, 
    notes?: string,
    locationId: string = 'aimogasta'
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

