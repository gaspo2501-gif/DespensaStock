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
  where,
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';
import { Expense, CreateExpenseInput, UpdateExpenseInput } from '../../types/expense';
import { LocationSelection } from '../../types/location';
import { toArgentinaDateString, getArgentinaToday, getArgentinaCurrentMonth } from '../../utils/dateUtils';

const EXPENSES_COLLECTION = 'expenses';
const LOCAL_EXPENSES_KEY = 'despensa_stock_local_expenses';
const LOCAL_PURCHASES_KEY = 'despensa_stock_local_purchases';

function getLocalExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(LOCAL_EXPENSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalExpenses(expenses: Expense[]) {
  try {
    localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(expenses));
  } catch (err) {
    console.warn('Failed to save expenses to localStorage:', err);
  }
}

export const expenseService = {
  /**
   * Create a new expense document in Firestore and update local storage cache.
   */
  async createExpense(input: CreateExpenseInput, locationId: string = 'aimogasta'): Promise<Expense> {
    if (!input.category) {
      throw new Error('Debe seleccionar una categoría');
    }
    if (!input.description || !input.description.trim()) {
      throw new Error('Debe ingresar una descripción o concepto');
    }
    if (input.amount <= 0 || isNaN(input.amount)) {
      throw new Error('El importe debe ser un número mayor a cero');
    }

    const targetLocationKey = input.locationId || locationId || 'aimogasta';
    const nowIso = new Date().toISOString();
    const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newExpense: Expense = {
      id: expenseId,
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      date: input.date || getArgentinaToday(),
      paymentMethod: input.paymentMethod || 'cash',
      locationId: targetLocationKey,
      notes: input.notes?.trim() || '',
      recurrent: Boolean(input.recurrent),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      const expRef = doc(db, EXPENSES_COLLECTION, expenseId);
      await setDoc(expRef, {
        id: newExpense.id,
        category: newExpense.category,
        description: newExpense.description,
        amount: newExpense.amount,
        date: newExpense.date,
        paymentMethod: newExpense.paymentMethod,
        locationId: targetLocationKey,
        notes: newExpense.notes,
        recurrent: newExpense.recurrent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn('Error saving expense to Firestore, using local fallback:', error);
    }

    // Save to local cache
    const local = getLocalExpenses();
    local.unshift(newExpense);
    saveLocalExpenses(local);

    return newExpense;
  },

  /**
   * Get all registered expenses ordered by date descending, optionally filtered by locationId.
   */
  async getExpenses(locationId?: LocationSelection): Promise<Expense[]> {
    let list: Expense[] = [];

    try {
      const q = query(
        collection(db, EXPENSES_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let dateStr = data.date;
        if (!dateStr && (data.createdAt || data.createdAtIso)) {
          dateStr = toArgentinaDateString(data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || data.createdAtIso));
        }

        const expLocation = data.locationId || 'aimogasta';

        if (!locationId || locationId === 'all' || expLocation === locationId) {
          list.push({
            id: docSnap.id,
            category: data.category || 'Otros',
            description: data.description || '',
            amount: data.amount || 0,
            date: dateStr || getArgentinaToday(),
            paymentMethod: data.paymentMethod || 'cash',
            locationId: expLocation,
            notes: data.notes || '',
            recurrent: Boolean(data.recurrent),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
            status: data.status || undefined,
            cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
            cancellationReason: data.cancellationReason || undefined,
          });
        }
      });
    } catch (err) {
      console.warn('Error querying expenses from Firestore, using local cache fallback:', err);
      const local = getLocalExpenses();
      list = (!locationId || locationId === 'all')
        ? local
        : local.filter(e => (e.locationId || 'aimogasta') === locationId);
    }

    // Sort descending by date, then by createdAt
    list.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  },

  /**
   * Update an existing expense.
   */
  async updateExpense(id: string, updates: UpdateExpenseInput): Promise<Expense> {
    const nowIso = new Date().toISOString();
    let updatedExpense: Expense | null = null;

    // Update local cache first
    const local = getLocalExpenses();
    const index = local.findIndex((e) => e.id === id);
    if (index !== -1) {
      local[index] = {
        ...local[index],
        ...updates,
        updatedAt: nowIso,
      };
      updatedExpense = local[index];
      saveLocalExpenses(local);
    }

    try {
      const expRef = doc(db, EXPENSES_COLLECTION, id);
      const fsUpdates: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };
      if (updates.category !== undefined) fsUpdates.category = updates.category;
      if (updates.description !== undefined) fsUpdates.description = updates.description.trim();
      if (updates.amount !== undefined) fsUpdates.amount = updates.amount;
      if (updates.date !== undefined) fsUpdates.date = updates.date;
      if (updates.paymentMethod !== undefined) fsUpdates.paymentMethod = updates.paymentMethod;
      if (updates.notes !== undefined) fsUpdates.notes = updates.notes.trim();
      if (updates.recurrent !== undefined) fsUpdates.recurrent = updates.recurrent;

      await updateDoc(expRef, fsUpdates);
    } catch (err) {
      console.warn('Error updating expense in Firestore:', err);
    }

    if (!updatedExpense) {
      // Re-fetch list if not found in local cache
      const fresh = await this.getExpenses();
      const found = fresh.find((e) => e.id === id);
      if (!found) throw new Error('No se encontró el gasto a actualizar');
      return found;
    }

    return updatedExpense;
  },

  /**
   * Cancel an existing expense atomically:
   * 1. Validates that expense exists and is not already cancelled.
   * 2. Cancels any linked cash movement (in cash_movements).
   * 3. Sets expense status to CANCELLED with cancelledAt and reason.
   * 4. Updates local caches.
   */
  async cancelExpense(expenseId: string, reason: string): Promise<Expense> {
    if (!expenseId) throw new Error('ID de gasto no válido');
    if (!reason?.trim()) throw new Error('Debe proporcionar un motivo de anulación');

    const cleanReason = reason.trim();
    const nowIso = new Date().toISOString();

    // Look for corresponding cash movement
    let existingCashMovRef: any = null;
    const directCashRef = doc(db, 'cash_movements', `mov_cash_expense_${expenseId}`);
    const directSnap = await getDoc(directCashRef);
    if (directSnap.exists()) {
      existingCashMovRef = directCashRef;
    } else {
      const cashQ = query(
        collection(db, 'cash_movements'),
        where('sourceType', '==', 'EXPENSE'),
        where('sourceId', '==', expenseId)
      );
      const cashSnap = await getDocs(cashQ);
      if (!cashSnap.empty) {
        existingCashMovRef = cashSnap.docs[0].ref;
      }
    }

    let returnedExpense: Expense | null = null;

    await runTransaction(db, async (transaction) => {
      const expRef = doc(db, EXPENSES_COLLECTION, expenseId);
      const expDoc = await transaction.get(expRef);
      if (!expDoc.exists()) {
        throw new Error(`No se encontró el registro de gasto (${expenseId})`);
      }

      const expData = expDoc.data();
      if (expData.status === 'CANCELLED') {
        throw new Error('Este gasto ya fue anulado previamente.');
      }

      // Check cash movement inside transaction
      let cashSnapInTx: any = null;
      if (existingCashMovRef) {
        cashSnapInTx = await transaction.get(existingCashMovRef);
      }

      // --- WRITES ---
      // A: If cash movement exists and active, mark CANCELLED
      if (existingCashMovRef && cashSnapInTx && cashSnapInTx.exists()) {
        transaction.update(existingCashMovRef, {
          status: 'CANCELLED',
          cancelledAt: serverTimestamp(),
          cancelledAtIso: nowIso,
          cancellationReason: cleanReason,
        });
      }

      // B: Mark expense as CANCELLED
      transaction.update(expRef, {
        status: 'CANCELLED',
        cancelledAt: serverTimestamp(),
        cancelledAtIso: nowIso,
        cancellationReason: cleanReason,
        updatedAt: serverTimestamp(),
      });

      let dateStr = expData.date;
      if (expData.date?.toDate) {
        dateStr = toArgentinaDateString(expData.date.toDate());
      }

      returnedExpense = {
        id: expenseId,
        category: expData.category || 'Otros',
        description: expData.description || '',
        amount: expData.amount || 0,
        date: dateStr || getArgentinaToday(),
        paymentMethod: expData.paymentMethod || 'cash',
        locationId: expData.locationId || 'aimogasta',
        notes: expData.notes || '',
        recurrent: Boolean(expData.recurrent),
        createdAt: expData.createdAt?.toDate ? expData.createdAt.toDate().toISOString() : (expData.createdAt || nowIso),
        updatedAt: nowIso,
        status: 'CANCELLED',
        cancelledAt: nowIso,
        cancellationReason: cleanReason,
      };
    });

    // Local caches update
    if (returnedExpense) {
      const local = getLocalExpenses();
      const idx = local.findIndex(e => e.id === expenseId);
      if (idx >= 0) {
        local[idx] = returnedExpense;
      } else {
        local.unshift(returnedExpense);
      }
      saveLocalExpenses(local);

      // Also update local cash movement if present
      try {
        const rawCash = localStorage.getItem('despensa_stock_local_cash_movements');
        if (rawCash) {
          const localCash = JSON.parse(rawCash);
          const cIdx = localCash.findIndex((c: any) => c.sourceType === 'EXPENSE' && c.sourceId === expenseId);
          if (cIdx >= 0) {
            localCash[cIdx].status = 'CANCELLED';
            localCash[cIdx].cancelledAt = nowIso;
            localCash[cIdx].cancellationReason = cleanReason;
            localStorage.setItem('despensa_stock_local_cash_movements', JSON.stringify(localCash));
          }
        }
      } catch {}
    }

    return returnedExpense!;
  },

  /**
   * Delete an expense by ID.
   */
  async deleteExpense(id: string): Promise<void> {
    // Delete from local cache
    const local = getLocalExpenses();
    const filtered = local.filter((e) => e.id !== id);
    saveLocalExpenses(filtered);

    try {
      const expRef = doc(db, EXPENSES_COLLECTION, id);
      await deleteDoc(expRef);
    } catch (err) {
      console.warn('Error deleting expense from Firestore:', err);
    }
  },

  /**
   * Calculate total merchandise purchases from purchases collection for period comparison.
   * Filtered by locationId if provided.
   */
  async getMerchandisePurchases(filter?: 'today' | 'month' | 'all', locationId?: LocationSelection): Promise<number> {
    let purchases: { totalAmount: number; createdAt: string; purchaseDate?: string; locationId?: string; status?: string }[] = [];

    try {
      const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === 'CANCELLED') return; // Exclude cancelled purchases
        let dateStr = data.createdAt;
        if (data.createdAt?.toDate) {
          dateStr = data.createdAt.toDate().toISOString();
        }
        purchases.push({
          totalAmount: data.totalAmount || 0,
          createdAt: dateStr || new Date().toISOString(),
          purchaseDate: data.purchaseDate,
          locationId: data.locationId || 'aimogasta',
          status: data.status,
        });
      });
    } catch (err) {
      console.warn('Error querying purchases from Firestore, checking local storage:', err);
      try {
        const raw = localStorage.getItem(LOCAL_PURCHASES_KEY);
        if (raw) purchases = JSON.parse(raw);
        purchases = purchases.filter(p => p.status !== 'CANCELLED');
      } catch {}
    }

    if (locationId && locationId !== 'all') {
      purchases = purchases.filter(p => (p.locationId || 'aimogasta') === locationId);
    }

    const todayStr = getArgentinaToday();
    const currentMonthPrefix = getArgentinaCurrentMonth(); // YYYY-MM

    return purchases.reduce((acc, p) => {
      const pDateStr = toArgentinaDateString(p.purchaseDate || p.createdAt) || getArgentinaToday();

      if (filter === 'today') {
        if (pDateStr === todayStr) return acc + p.totalAmount;
        return acc;
      }

      if (filter === 'month') {
        if (pDateStr.startsWith(currentMonthPrefix)) return acc + p.totalAmount;
        return acc;
      }

      return acc + p.totalAmount;
    }, 0);
  },

  /**
   * Get single expense by ID
   */
  async getExpenseById(id: string): Promise<Expense | null> {
    const local = getLocalExpenses();
    const foundLocal = local.find((e) => e.id === id);
    if (foundLocal) return foundLocal;

    try {
      const expRef = doc(db, EXPENSES_COLLECTION, id);
      const snap = await getDoc(expRef);
      if (snap.exists()) {
        const data = snap.data();
        let dateStr = data.date;
        if (!dateStr && (data.createdAt || data.createdAtIso)) {
          dateStr = toArgentinaDateString(data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || data.createdAtIso));
        }
        return {
          id: snap.id,
          category: data.category || 'Otros',
          description: data.description || '',
          amount: data.amount || 0,
          date: dateStr || getArgentinaToday(),
          paymentMethod: data.paymentMethod || 'cash',
          locationId: data.locationId || 'aimogasta',
          notes: data.notes || '',
          recurrent: Boolean(data.recurrent),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
        };
      }
    } catch (err) {
      console.warn('Error fetching expense by ID:', err);
    }
    return null;
  },
};

