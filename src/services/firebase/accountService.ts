import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  runTransaction,
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';
import { AccountMovement } from '../../types/account';
import { LocationSelection } from '../../types/location';

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
   * Fetch all movements for a specific customer, optionally filtered by locationId
   */
  async getCustomerMovements(customerId: string, locationId?: LocationSelection): Promise<AccountMovement[]> {
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
        const movLoc = data.locationId || 'aimogasta';
        if (!locationId || locationId === 'all' || movLoc === locationId) {
          movements.push({
            id: docSnap.id,
            customerId: data.customerId,
            type: data.type,
            amount: data.amount || 0,
            createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
            description: data.description || '',
            saleId: data.saleId || undefined,
            locationId: movLoc,
            notes: data.notes || '',
            paymentMethod: data.paymentMethod || undefined,
            status: data.status || undefined,
            cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
            cancellationReason: data.cancellationReason || undefined,
          });
        }
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
        .filter((m) => m.customerId === customerId && (!locationId || locationId === 'all' || (m.locationId || 'aimogasta') === locationId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  /**
   * Get all movements from all customers, optionally filtered by locationId
   */
  async getAllMovements(locationId?: LocationSelection): Promise<AccountMovement[]> {
    try {
      const q = query(collection(db, MOVEMENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const movements: AccountMovement[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const movLoc = data.locationId || 'aimogasta';
        if (!locationId || locationId === 'all' || movLoc === locationId) {
          movements.push({
            id: docSnap.id,
            customerId: data.customerId,
            type: data.type,
            amount: data.amount || 0,
            createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
            description: data.description || '',
            saleId: data.saleId || undefined,
            locationId: movLoc,
            notes: data.notes || '',
            paymentMethod: data.paymentMethod || undefined,
            status: data.status || undefined,
            cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
            cancellationReason: data.cancellationReason || undefined,
          });
        }
      });

      saveLocalMovements(movements);
      return movements;
    } catch (err) {
      console.warn('Error al obtener todos los movimientos de Firestore, usando cache local:', err);
      const local = getLocalMovements();
      if (!locationId || locationId === 'all') return local;
      return local.filter(m => (m.locationId || 'aimogasta') === locationId);
    }
  },

  /**
   * Get a single account movement by ID
   */
  async getMovementById(movementId: string): Promise<AccountMovement | null> {
    try {
      const docRef = doc(db, MOVEMENTS_COLLECTION, movementId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          customerId: data.customerId,
          type: data.type,
          amount: data.amount || 0,
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          description: data.description || '',
          saleId: data.saleId || undefined,
          locationId: data.locationId || 'aimogasta',
          notes: data.notes || '',
          paymentMethod: data.paymentMethod || undefined,
          status: data.status || undefined,
          cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
          cancellationReason: data.cancellationReason || undefined,
        };
      }
    } catch (err) {
      console.warn('Error al obtener movimiento de cuenta de Firestore:', err);
    }
    const local = getLocalMovements();
    return local.find((m) => m.id === movementId) || null;
  },

  /**
   * Calculate current pending debt balance for a single customer (excluding cancelled movements)
   */
  async getCustomerBalance(customerId: string, locationId?: LocationSelection): Promise<number> {
    const movements = await this.getCustomerMovements(customerId, locationId);
    let balance = 0;
    for (const mov of movements) {
      if (mov.status === 'CANCELLED') continue; // Ignorar operaciones anuladas
      if (mov.type === 'DEBT') {
        balance += mov.amount;
      } else if (mov.type === 'PAYMENT') {
        balance -= mov.amount;
      }
    }
    return Math.max(0, balance);
  },

  /**
   * Get map of customer balances: { [customerId]: balance } (excluding cancelled movements)
   */
  async getAllBalances(locationId?: LocationSelection): Promise<Record<string, number>> {
    const allMovements = await this.getAllMovements(locationId);
    const balances: Record<string, number> = {};

    for (const mov of allMovements) {
      if (mov.status === 'CANCELLED') continue; // Ignorar operaciones anuladas
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
    locationId: string = 'aimogasta',
    notes?: string
  ): Promise<AccountMovement> {
    if (amount <= 0) {
      throw new Error('El importe de la deuda debe ser mayor a cero.');
    }

    const targetLoc = locationId || 'aimogasta';
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
      locationId: targetLoc,
      notes,
    };

    const firestorePayload: Record<string, any> = {
      id: movementId,
      customerId,
      type: 'DEBT',
      amount,
      description: newMov.description,
      locationId: targetLoc,
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
    paymentMethod: 'cash' | 'mercado_pago' | 'transfer' | 'other' = 'cash',
    locationId: string = 'aimogasta'
  ): Promise<AccountMovement> {
    if (amount <= 0) {
      throw new Error('El importe del pago debe ser mayor a cero.');
    }

    const targetLoc = locationId || 'aimogasta';
    const currentBalance = await this.getCustomerBalance(customerId);
    if (amount > currentBalance) {
      throw new Error(
        `El pago (${amount.toLocaleString('es-AR')}) no puede superar la deuda pendiente actual (${currentBalance.toLocaleString('es-AR')}).`
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
      locationId: targetLoc,
      paymentMethod,
    };

    const firestorePayload: Record<string, any> = {
      id: movementId,
      customerId,
      type: 'PAYMENT',
      amount,
      paymentMethod,
      locationId: targetLoc,
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

  /**
   * Cancel an existing customer payment atomically:
   * 1. Validates that movement exists and is of type PAYMENT.
   * 2. Validates that it's not already CANCELLED.
   * 3. Cancels any associated cash movement (in cash_movements).
   * 4. Updates payment movement to CANCELLED.
   * 5. Updates local caches.
   */
  async cancelPayment(paymentId: string, reason: string): Promise<AccountMovement> {
    if (!paymentId) throw new Error('ID de pago no válido');
    if (!reason?.trim()) throw new Error('Debe proporcionar un motivo de anulación');

    const cleanReason = reason.trim();
    const nowIso = new Date().toISOString();

    // Look for corresponding cash movement
    let existingCashMovRef: any = null;
    const directCashRef1 = doc(db, 'cash_movements', `mov_cash_customer_payment_${paymentId}`);
    const directCashRef2 = doc(db, 'cash_movements', `mov_cash_pay_${paymentId}`);
    const direct1Snap = await getDoc(directCashRef1);
    if (direct1Snap.exists()) {
      existingCashMovRef = directCashRef1;
    } else {
      const direct2Snap = await getDoc(directCashRef2);
      if (direct2Snap.exists()) {
        existingCashMovRef = directCashRef2;
      } else {
        const cashQ = query(
          collection(db, 'cash_movements'),
          where('sourceType', '==', 'CUSTOMER_PAYMENT'),
          where('sourceId', '==', paymentId)
        );
        const cashSnap = await getDocs(cashQ);
        if (!cashSnap.empty) {
          existingCashMovRef = cashSnap.docs[0].ref;
        }
      }
    }

    let returnedMovement: AccountMovement | null = null;

    await runTransaction(db, async (transaction) => {
      const movRef = doc(db, MOVEMENTS_COLLECTION, paymentId);
      const movDoc = await transaction.get(movRef);
      if (!movDoc.exists()) {
        throw new Error(`No se encontró el comprobante de pago (${paymentId})`);
      }

      const movData = movDoc.data();
      if (movData.type !== 'PAYMENT') {
        throw new Error('El comprobante indicado no corresponde a un pago de cliente.');
      }
      if (movData.status === 'CANCELLED') {
        throw new Error('Este pago ya fue anulado previamente.');
      }

      // Check cash movement inside transaction
      let cashSnapInTx: any = null;
      if (existingCashMovRef) {
        cashSnapInTx = await transaction.get(existingCashMovRef);
      }

      // --- WRITES ---
      // A: If cash movement found, mark CANCELLED
      if (existingCashMovRef && cashSnapInTx && cashSnapInTx.exists()) {
        transaction.update(existingCashMovRef, {
          status: 'CANCELLED',
          cancelledAt: serverTimestamp(),
          cancelledAtIso: nowIso,
          cancellationReason: cleanReason,
        });
      }

      // B: Mark payment movement as CANCELLED
      transaction.update(movRef, {
        status: 'CANCELLED',
        cancelledAt: serverTimestamp(),
        cancelledAtIso: nowIso,
        cancellationReason: cleanReason,
      });

      returnedMovement = {
        id: paymentId,
        customerId: movData.customerId,
        type: 'PAYMENT',
        amount: movData.amount || 0,
        createdAt: movData.createdAtIso || (movData.createdAt?.toDate ? movData.createdAt.toDate().toISOString() : nowIso),
        description: movData.description || 'Pago a cuenta',
        saleId: movData.saleId,
        locationId: movData.locationId || 'aimogasta',
        notes: movData.notes,
        paymentMethod: movData.paymentMethod,
        status: 'CANCELLED',
        cancelledAt: nowIso,
        cancellationReason: cleanReason,
      };
    });

    // Local caches update
    if (returnedMovement) {
      const local = getLocalMovements();
      const idx = local.findIndex(m => m.id === paymentId);
      if (idx >= 0) {
        local[idx] = returnedMovement;
      } else {
        local.unshift(returnedMovement);
      }
      saveLocalMovements(local);

      // Also update local cash movements if any
      try {
        const rawCash = localStorage.getItem('despensa_stock_local_cash_movements');
        if (rawCash) {
          const localCash = JSON.parse(rawCash);
          const cIdx = localCash.findIndex((c: any) => c.sourceType === 'CUSTOMER_PAYMENT' && c.sourceId === paymentId);
          if (cIdx >= 0) {
            localCash[cIdx].status = 'CANCELLED';
            localCash[cIdx].cancelledAt = nowIso;
            localCash[cIdx].cancellationReason = cleanReason;
            localStorage.setItem('despensa_stock_local_cash_movements', JSON.stringify(localCash));
          }
        }
      } catch {}
    }

    return returnedMovement!;
  },
};

