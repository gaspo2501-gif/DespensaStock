import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';
import { AccountMovement } from '../../types/account';

const MOVEMENTS_COLLECTION = 'account_movements';
const LOCAL_MOVEMENTS_KEY = 'despensa_stock_local_movements';

function getLocalMovements(): AccountMovement[] {
  try {
    const raw = localStorage.getItem(LOCAL_MOVEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMovements(movements: AccountMovement[]) {
  try {
    localStorage.setItem(LOCAL_MOVEMENTS_KEY, JSON.stringify(movements));
  } catch (err) {
    console.warn('Error al guardar movimientos de cuenta localmente:', err);
  }
}

export const accountService = {
  /**
   * Fetch all movements for a specific customer
   */
  async getCustomerMovements(customerId: string): Promise<AccountMovement[]> {
    try {
      const q = query(
        collection(db, MOVEMENTS_COLLECTION),
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const movements: AccountMovement[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        movements.push({
          id: docSnap.id,
          customerId: data.customerId,
          type: data.type,
          amount: data.amount || 0,
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          description: data.description || '',
          saleId: data.saleId || undefined,
          notes: data.notes || '',
        });
      });

      // Update local storage for this customer's movements
      const local = getLocalMovements();
      const otherCustomersLocal = local.filter((m) => m.customerId !== customerId);
      saveLocalMovements([...otherCustomersLocal, ...movements]);

      return movements;
    } catch (err) {
      console.warn(`Error al obtener movimientos de Firestore para el cliente ${customerId}, usando cache local:`, err);
      const local = getLocalMovements();
      return local
        .filter((m) => m.customerId === customerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  /**
   * Get all movements from all customers
   */
  async getAllMovements(): Promise<AccountMovement[]> {
    try {
      const q = query(collection(db, MOVEMENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const movements: AccountMovement[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        movements.push({
          id: docSnap.id,
          customerId: data.customerId,
          type: data.type,
          amount: data.amount || 0,
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          description: data.description || '',
          saleId: data.saleId || undefined,
          notes: data.notes || '',
        });
      });

      saveLocalMovements(movements);
      return movements;
    } catch (err) {
      console.warn('Error al obtener todos los movimientos de Firestore, usando cache local:', err);
      return getLocalMovements();
    }
  },

  /**
   * Calculate current pending debt balance for a single customer
   */
  async getCustomerBalance(customerId: string): Promise<number> {
    const movements = await this.getCustomerMovements(customerId);
    let balance = 0;
    for (const mov of movements) {
      if (mov.type === 'DEBT') {
        balance += mov.amount;
      } else if (mov.type === 'PAYMENT') {
        balance -= mov.amount;
      }
    }
    return Math.max(0, balance);
  },

  /**
   * Get map of customer balances: { [customerId]: balance }
   */
  async getAllBalances(): Promise<Record<string, number>> {
    const allMovements = await this.getAllMovements();
    const balances: Record<string, number> = {};

    for (const mov of allMovements) {
      if (!balances[mov.customerId]) {
        balances[mov.customerId] = 0;
      }
      if (mov.type === 'DEBT') {
        balances[mov.customerId] += mov.amount;
      } else if (mov.type === 'PAYMENT') {
        balances[mov.customerId] -= mov.amount;
      }
    }

    // Ensure no negative balances due to rounding
    for (const cid of Object.keys(balances)) {
      if (balances[cid] < 0) balances[cid] = 0;
    }

    return balances;
  },

  /**
   * Register a new DEBT movement (e.g. fiado sale)
   */
  async registerDebt(
    customerId: string, 
    amount: number, 
    description: string, 
    saleId?: string, 
    notes?: string
  ): Promise<AccountMovement> {
    if (amount <= 0) {
      throw new Error('El importe de la deuda debe ser mayor a cero.');
    }

    const nowIso = new Date().toISOString();
    const movementId = `mov_debt_${Date.now()}`;

    const newMov: AccountMovement = {
      id: movementId,
      customerId,
      type: 'DEBT',
      amount,
      createdAt: nowIso,
      description: description || 'Venta fiada',
      saleId,
      notes,
    };

    const firestorePayload: Record<string, any> = {
      id: movementId,
      customerId,
      type: 'DEBT',
      amount,
      description: newMov.description,
      createdAtIso: nowIso,
      createdAt: serverTimestamp(),
    };
    if (saleId) firestorePayload.saleId = saleId;
    if (notes) firestorePayload.notes = notes;

    try {
      const docRef = doc(db, MOVEMENTS_COLLECTION, movementId);
      await setDoc(docRef, firestorePayload);
    } catch (err) {
      console.warn('Error al registrar deuda en Firestore:', err);
    }

    const local = getLocalMovements();
    local.unshift(newMov);
    saveLocalMovements(local);

    return newMov;
  },

  /**
   * Register a PAYMENT movement from customer
   */
  async registerPayment(
    customerId: string, 
    amount: number, 
    notes?: string,
    paymentMethod: 'cash' | 'mercado_pago' | 'transfer' | 'other' = 'cash'
  ): Promise<AccountMovement> {
    if (amount <= 0) {
      throw new Error('El importe del pago debe ser mayor a cero.');
    }

    const currentBalance = await this.getCustomerBalance(customerId);
    if (amount > currentBalance) {
      throw new Error(
        `El pago ($${amount.toLocaleString('es-AR')}) no puede superar la deuda pendiente actual ($${currentBalance.toLocaleString('es-AR')}).`
      );
    }

    const nowIso = new Date().toISOString();
    const movementId = `mov_pay_${Date.now()}`;

    const newMov: AccountMovement & { paymentMethod?: string } = {
      id: movementId,
      customerId,
      type: 'PAYMENT',
      amount,
      createdAt: nowIso,
      description: 'Pago a cuenta',
      notes,
      paymentMethod,
    };

    const firestorePayload: Record<string, any> = {
      id: movementId,
      customerId,
      type: 'PAYMENT',
      amount,
      paymentMethod,
      description: newMov.description,
      createdAtIso: nowIso,
      createdAt: serverTimestamp(),
    };
    if (notes) firestorePayload.notes = notes;

    try {
      const docRef = doc(db, MOVEMENTS_COLLECTION, movementId);
      await setDoc(docRef, firestorePayload);
    } catch (err) {
      console.warn('Error al registrar pago en Firestore:', err);
    }

    const local = getLocalMovements();
    local.unshift(newMov as AccountMovement);
    saveLocalMovements(local);

    return newMov as AccountMovement;
  },
};
