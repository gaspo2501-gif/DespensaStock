import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
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
import { salesService } from './salesService';
import { expenseService } from './expenseService';
import { accountService } from './accountService';

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
  async createCashMovement(input: CreateCashMovementInput): Promise<CashMovement> {
    if (!input.description || !input.description.trim()) {
      throw new Error('Debe ingresar un concepto o descripción para el movimiento.');
    }
    if (input.amount <= 0 || isNaN(input.amount)) {
      throw new Error('El importe debe ser un número mayor a cero.');
    }

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
      date: input.date || nowIso.split('T')[0],
      sourceType: input.sourceType || 'MANUAL',
      sourceId: input.sourceId || movementId,
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
   * Fetch all consolidated cash movements (combines manual movements, sales, expenses, and customer payments).
   * Ensures NO DUPLICATES using sourceType and sourceId.
   */
  async getCashMovements(): Promise<CashMovement[]> {
    let manualAndSavedMovements: CashMovement[] = [];

    // 1. Fetch from Firestore cash_movements collection
    try {
      const q = query(collection(db, CASH_MOVEMENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let dateStr = data.date;
        if (!dateStr && data.createdAtIso) {
          dateStr = data.createdAtIso.split('T')[0];
        }

        manualAndSavedMovements.push({
          id: docSnap.id,
          type: data.type || 'INCOME',
          amount: data.amount || 0,
          paymentMethod: data.paymentMethod || 'cash',
          description: data.description || '',
          date: dateStr || new Date().toISOString().split('T')[0],
          sourceType: data.sourceType || 'MANUAL',
          sourceId: data.sourceId || docSnap.id,
          notes: data.notes || '',
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
        });
      });

      saveLocalCashMovements(manualAndSavedMovements);
    } catch (err) {
      console.warn('Error al obtener movimientos de caja de Firestore, usando cache local:', err);
      manualAndSavedMovements = getLocalCashMovements();
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
      const sales = await salesService.getRecentSales();
      for (const sale of sales) {
        if (sale.paymentMethod === 'credit') continue; // Fiado sales do NOT generate cash income

        const key = getSourceKey('SALE', sale.id);
        if (!movementMap.has(key)) {
          const saleDateStr = sale.createdAt ? sale.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
          const synthMov: CashMovement = {
            id: `mov_cash_sale_${sale.id}`,
            type: 'INCOME',
            amount: sale.totalAmount,
            paymentMethod: (sale.paymentMethod as CashPaymentMethod) || 'cash',
            description: `Venta #${sale.id.replace('sale_', '')}`,
            date: saleDateStr,
            sourceType: 'SALE',
            sourceId: sale.id,
            notes: `${sale.totalItemsCount} ítems`,
            createdAt: sale.createdAt || new Date().toISOString(),
          };
          movementMap.set(key, synthMov);
        }
      }
    } catch (err) {
      console.warn('Error al consolidar ventas en caja:', err);
    }

    // 3. Consolidate Expenses
    try {
      const expenses = await expenseService.getExpenses();
      for (const exp of expenses) {
        const key = getSourceKey('EXPENSE', exp.id);
        if (!movementMap.has(key)) {
          const synthMov: CashMovement = {
            id: `mov_cash_exp_${exp.id}`,
            type: 'EXPENSE',
            amount: exp.amount,
            paymentMethod: exp.paymentMethod || 'cash',
            description: `${exp.category}: ${exp.description}`,
            date: exp.date,
            sourceType: 'EXPENSE',
            sourceId: exp.id,
            notes: exp.notes || '',
            createdAt: exp.createdAt || new Date().toISOString(),
          };
          movementMap.set(key, synthMov);
        }
      }
    } catch (err) {
      console.warn('Error al consolidar gastos en caja:', err);
    }

    // 4. Consolidate Customer Debt Payments (account_movements where type === 'PAYMENT')
    try {
      const accountMovs = await accountService.getAllMovements();
      for (const accMov of accountMovs) {
        if (accMov.type !== 'PAYMENT') continue;

        const key = getSourceKey('CUSTOMER_PAYMENT', accMov.id);
        if (!movementMap.has(key)) {
          const payDateStr = accMov.createdAt ? accMov.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
          const synthMov: CashMovement = {
            id: `mov_cash_pay_${accMov.id}`,
            type: 'INCOME',
            amount: accMov.amount,
            paymentMethod: (accMov as any).paymentMethod || 'cash',
            description: accMov.description || 'Cobro cliente fiado',
            date: payDateStr,
            sourceType: 'CUSTOMER_PAYMENT',
            sourceId: accMov.id,
            notes: accMov.notes || '',
            createdAt: accMov.createdAt || new Date().toISOString(),
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
  async setInitialBalance(amount: number, date?: string, notes?: string): Promise<CashMovement> {
    return this.createCashMovement({
      type: 'INCOME',
      amount,
      paymentMethod: 'cash',
      description: 'Saldo inicial de caja',
      date: date || new Date().toISOString().split('T')[0],
      sourceType: 'MANUAL',
      sourceId: `initial_${Date.now()}`,
      notes: notes || 'Ajuste / Saldo de apertura inicial',
    });
  },

  /**
   * Calculate current balances by payment method (Cash, Mercado Pago, Transfer) & Today's Summary.
   */
  async getCashSummary(): Promise<CashBalanceSummary> {
    const movements = await this.getCashMovements();

    const todayStr = new Date().toISOString().split('T')[0];

    let cashBalance = 0;
    let mercadoPagoBalance = 0;
    let transferBalance = 0;
    let otherBalance = 0;

    let todayIncome = 0;
    let todayExpense = 0;

    for (const mov of movements) {
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
    notes?: string
  ): Promise<CashClosure> {
    const nowIso = new Date().toISOString();
    const closureId = `closure_${Date.now()}`;
    const difference = countedCash - expectedCash;

    const newClosure: CashClosure = {
      id: closureId,
      date: nowIso.split('T')[0],
      expectedCash,
      countedCash,
      difference,
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
  async getCashClosures(): Promise<CashClosure[]> {
    try {
      const q = query(collection(db, CASH_CLOSURES_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const closures: CashClosure[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        closures.push({
          id: docSnap.id,
          date: data.date || new Date().toISOString().split('T')[0],
          expectedCash: data.expectedCash || 0,
          countedCash: data.countedCash || 0,
          difference: data.difference || 0,
          notes: data.notes || '',
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
        });
      });

      saveLocalCashClosures(closures);
      return closures;
    } catch (err) {
      console.warn('Error al obtener cierres de caja de Firestore, usando cache local:', err);
      return getLocalCashClosures();
    }
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
