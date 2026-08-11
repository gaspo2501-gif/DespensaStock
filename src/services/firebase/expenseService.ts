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
import { Expense, CreateExpenseInput, UpdateExpenseInput } from '../../types/expense';
import { LocationSelection } from '../../types/location';

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
      date: input.date || nowIso.split('T')[0],
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
        if (!dateStr && data.createdAt?.toDate) {
          dateStr = data.createdAt.toDate().toISOString().split('T')[0];
        }

        const expLocation = data.locationId || 'aimogasta';

        if (!locationId || locationId === 'all' || expLocation === locationId) {
          list.push({
            id: docSnap.id,
            category: data.category || 'Otros',
            description: data.description || '',
            amount: data.amount || 0,
            date: dateStr || new Date().toISOString().split('T')[0],
            paymentMethod: data.paymentMethod || 'cash',
            locationId: expLocation,
            notes: data.notes || '',
            recurrent: Boolean(data.recurrent),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
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
    let purchases: { totalAmount: number; createdAt: string; locationId?: string }[] = [];

    try {
      const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let dateStr = data.createdAt;
        if (data.createdAt?.toDate) {
          dateStr = data.createdAt.toDate().toISOString();
        }
        purchases.push({
          totalAmount: data.totalAmount || 0,
          createdAt: dateStr || new Date().toISOString(),
          locationId: data.locationId || 'aimogasta',
        });
      });
    } catch (err) {
      console.warn('Error querying purchases from Firestore, checking local storage:', err);
      try {
        const raw = localStorage.getItem(LOCAL_PURCHASES_KEY);
        if (raw) purchases = JSON.parse(raw);
      } catch {}
    }

    if (locationId && locationId !== 'all') {
      purchases = purchases.filter(p => (p.locationId || 'aimogasta') === locationId);
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM

    return purchases.reduce((acc, p) => {
      const pDateStr = new Date(p.createdAt).toISOString().split('T')[0];

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
  }
};

