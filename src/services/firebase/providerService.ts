import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';
import { Provider, CreateProviderInput, SupplierPayment, CreateSupplierPaymentInput } from '../../types/provider';
import { Purchase } from '../../types/purchase';
import { cashService } from './cashService';
import { getArgentinaToday } from '../../utils/dateUtils';

const PROVIDERS_COLLECTION = 'providers';
const SUPPLIER_PAYMENTS_COLLECTION = 'supplier_payments';
const PURCHASES_COLLECTION = 'purchases';
const LOCAL_STORAGE_KEY = 'despensa_stock_local_providers';
const LOCAL_PAYMENTS_KEY = 'despensa_stock_local_supplier_payments';

function getLocalProviders(): Provider[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalProviders(providers: Provider[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(providers));
  } catch (err) {
    console.warn('Failed to save providers to localStorage:', err);
  }
}

function getLocalSupplierPayments(): SupplierPayment[] {
  try {
    const raw = localStorage.getItem(LOCAL_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSupplierPayments(payments: SupplierPayment[]) {
  try {
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(payments));
  } catch (err) {
    console.warn('Failed to save supplier payments to localStorage:', err);
  }
}

export const providerService = {
  async getAllProviders(): Promise<Provider[]> {
    try {
      const q = query(collection(db, PROVIDERS_COLLECTION));
      const querySnapshot = await getDocs(q);
      const providers: Provider[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        providers.push({
          id: docSnap.id,
          name: data.name || 'Sin Nombre',
          phone: data.phone || '',
          notes: data.notes || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
        });
      });

      saveLocalProviders(providers);
      return providers.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    } catch (error) {
      console.warn('Error fetching providers from Firestore, using local fallback:', error);
      const local = getLocalProviders();
      return local.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }
  },

  async getProviderById(id: string): Promise<Provider | null> {
    const local = getLocalProviders();
    const foundLocal = local.find(p => p.id === id);
    if (foundLocal) return foundLocal;

    try {
      const docRef = doc(db, PROVIDERS_COLLECTION, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: snap.id,
          name: data.name || 'Sin Nombre',
          phone: data.phone || '',
          notes: data.notes || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
        };
      }
    } catch (err) {
      console.warn('Error fetching provider by ID:', err);
    }
    return null;
  },

  async saveProvider(input: CreateProviderInput): Promise<Provider> {
    const nameClean = input.name.trim();
    if (!nameClean) {
      throw new Error('El nombre del proveedor es obligatorio');
    }

    const nowIso = new Date().toISOString();
    const docId = `prov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newProvider: Provider = {
      id: docId,
      name: nameClean,
      phone: input.phone?.trim() || '',
      notes: input.notes?.trim() || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const docData: Record<string, any> = {
      name: newProvider.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (newProvider.phone) docData.phone = newProvider.phone;
    if (newProvider.notes) docData.notes = newProvider.notes;

    try {
      const docRef = doc(db, PROVIDERS_COLLECTION, docId);
      await setDoc(docRef, docData);
    } catch (error) {
      console.warn('Error saving provider to Firestore, saved locally:', error);
    }

    const local = getLocalProviders();
    local.push(newProvider);
    saveLocalProviders(local);

    return newProvider;
  },

  async updateProvider(id: string, updates: Partial<CreateProviderInput>): Promise<Provider> {
    const nowIso = new Date().toISOString();
    const docData: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (updates.name !== undefined) docData.name = updates.name.trim();
    if (updates.phone !== undefined) docData.phone = updates.phone.trim();
    if (updates.notes !== undefined) docData.notes = updates.notes.trim();

    try {
      const docRef = doc(db, PROVIDERS_COLLECTION, id);
      await updateDoc(docRef, docData);
    } catch (error) {
      console.warn('Error updating provider in Firestore:', error);
    }

    const local = getLocalProviders();
    const idx = local.findIndex(p => p.id === id);
    let updated: Provider;
    if (idx !== -1) {
      updated = {
        ...local[idx],
        ...updates,
        updatedAt: nowIso,
      };
      local[idx] = updated;
    } else {
      updated = {
        id,
        name: updates.name || 'Proveedor',
        phone: updates.phone || '',
        notes: updates.notes || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      local.push(updated);
    }
    saveLocalProviders(local);

    return updated;
  },

  async deleteProvider(id: string): Promise<void> {
    try {
      const docRef = doc(db, PROVIDERS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.warn('Error deleting provider from Firestore:', error);
    }

    const local = getLocalProviders().filter(p => p.id !== id);
    saveLocalProviders(local);
  },

  /**
   * Get all registered supplier payments, optionally filtered by providerId
   */
  async getSupplierPayments(providerId?: string): Promise<SupplierPayment[]> {
    let list: SupplierPayment[] = [];

    try {
      const q = query(collection(db, SUPPLIER_PAYMENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (providerId && data.providerId !== providerId) return;

        list.push({
          id: docSnap.id,
          providerId: data.providerId,
          providerName: data.providerName || 'Proveedor',
          purchaseId: data.purchaseId || undefined,
          amount: data.amount || 0,
          date: data.date || (data.createdAtIso ? data.createdAtIso.split('T')[0] : getArgentinaToday()),
          paidFrom: data.paidFrom || 'caja_diaria',
          locationId: data.locationId || 'aimogasta',
          notes: data.notes || '',
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          status: data.status || undefined,
          cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
          cancellationReason: data.cancellationReason || undefined,
        });
      });

      saveLocalSupplierPayments(list);
    } catch (err) {
      console.warn('Error fetching supplier payments from Firestore, using local cache:', err);
      const local = getLocalSupplierPayments();
      list = providerId ? local.filter(p => p.providerId === providerId) : local;
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Register a payment to a supplier:
   * 1. Records payment in `supplier_payments`.
   * 2. If purchaseId specified, updates purchase paidAmount & paymentStatus.
   * 3. Dispatches financial cash movement with sourceType 'SUPPLIER_PAYMENT' (discounts fund, NO operational expense created!).
   */
  async registerSupplierPayment(input: CreateSupplierPaymentInput): Promise<SupplierPayment> {
    if (!input.providerId || !input.providerName) {
      throw new Error('Debe especificar el proveedor');
    }
    if (!input.amount || input.amount <= 0 || isNaN(input.amount)) {
      throw new Error('El importe a pagar debe ser mayor a cero');
    }

    const nowIso = new Date().toISOString();
    const paymentId = `spay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const opDate = input.date || getArgentinaToday();
    const locId = input.locationId || 'aimogasta';

    const newPayment: SupplierPayment = {
      id: paymentId,
      providerId: input.providerId,
      providerName: input.providerName,
      purchaseId: input.purchaseId || undefined,
      amount: input.amount,
      date: opDate,
      paidFrom: input.paidFrom || 'caja_diaria',
      locationId: locId,
      notes: input.notes?.trim() || '',
      createdAt: nowIso,
    };

    // 1. Save to Firestore supplier_payments
    try {
      const payRef = doc(db, SUPPLIER_PAYMENTS_COLLECTION, paymentId);
      const payload: Record<string, any> = {
        id: paymentId,
        providerId: newPayment.providerId,
        providerName: newPayment.providerName,
        amount: newPayment.amount,
        date: newPayment.date,
        paidFrom: newPayment.paidFrom,
        locationId: locId,
        notes: newPayment.notes || '',
        createdAtIso: nowIso,
        createdAt: serverTimestamp(),
      };
      if (newPayment.purchaseId) payload.purchaseId = newPayment.purchaseId;

      await setDoc(payRef, payload);
    } catch (err) {
      console.warn('Error saving supplier payment to Firestore:', err);
    }

    // 2. If purchaseId is present, update purchase record
    if (input.purchaseId) {
      try {
        const purchRef = doc(db, PURCHASES_COLLECTION, input.purchaseId);
        const pSnap = await getDoc(purchRef);
        if (pSnap.exists()) {
          const pData = pSnap.data();
          const totalAmount = pData.totalAmount || 0;
          const prevPaid = pData.paidAmount || 0;
          const nextPaid = prevPaid + input.amount;
          const nextPending = Math.max(0, totalAmount - nextPaid);
          const nextStatus = nextPending <= 0.01 ? 'PAID' : 'PARTIAL';

          await updateDoc(purchRef, {
            paidAmount: nextPaid,
            pendingAmount: nextPending,
            paymentStatus: nextStatus,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Error updating purchase payment status:', err);
      }
    }

    // 3. Register cash movement (strictly financial outflow from chosen fund - NO duplicate expense!)
    try {
      const pm = input.paidFrom === 'mercado_pago' ? 'mercado_pago' : input.paidFrom === 'transfer' ? 'transfer' : 'cash';
      const crType = input.paidFrom === 'caja_general' ? 'caja_general' : input.paidFrom === 'caja_diaria' ? 'caja_diaria' : undefined;

      let desc = `Pago a proveedor: ${input.providerName}`;
      if (input.purchaseId) desc += ` (Compra #${input.purchaseId.slice(-6)})`;

      await cashService.createCashMovement({
        type: 'EXPENSE',
        amount: input.amount,
        paymentMethod: pm,
        description: desc,
        date: opDate,
        sourceType: 'SUPPLIER_PAYMENT',
        sourceId: paymentId,
        locationId: locId,
        notes: input.notes || 'Cancelación de deuda de mercadería',
        cashRegisterType: crType,
        paidFrom: input.paidFrom,
        providerId: input.providerId,
        providerName: input.providerName,
        purchaseId: input.purchaseId,
      }, locId);
    } catch (err) {
      console.warn('Error registering cash movement for supplier payment:', err);
    }

    // Save locally
    const local = getLocalSupplierPayments();
    local.unshift(newPayment);
    saveLocalSupplierPayments(local);

    return newPayment;
  },

  /**
   * Get detailed checking account (Cuenta Corriente) for a single supplier:
   * - Total comprado
   * - Total pagado
   * - Saldo pendiente
   * - All purchases
   * - All payments
   */
  async getProviderAccount(providerId: string): Promise<{
    provider: Provider | null;
    totalPurchased: number;
    totalPaid: number;
    currentDebt: number;
    purchases: Purchase[];
    payments: SupplierPayment[];
  }> {
    const [provider, allPayments] = await Promise.all([
      this.getProviderById(providerId),
      this.getSupplierPayments(providerId)
    ]);

    // Fetch purchases for this provider
    let purchases: Purchase[] = [];
    try {
      const q = query(
        collection(db, PURCHASES_COLLECTION),
        where('providerId', '==', providerId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      snap.forEach(d => {
        const data = d.data();
        if (data.status === 'CANCELLED') return;
        purchases.push({
          id: d.id,
          date: data.date,
          providerId: data.providerId,
          providerName: data.providerName,
          locationId: data.locationId,
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          totalAmount: data.totalAmount || 0,
          totalItemsCount: data.totalItemsCount || 0,
          items: data.items || [],
          status: data.status,
          paymentStatus: data.paymentStatus || (data.paidAmount && data.paidAmount >= (data.totalAmount || 0) ? 'PAID' : data.paidAmount && data.paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
          paidAmount: data.paidAmount || 0,
          pendingAmount: data.pendingAmount !== undefined ? data.pendingAmount : (data.totalAmount || 0) - (data.paidAmount || 0),
          paidFrom: data.paidFrom,
          paymentMethod: data.paymentMethod,
        });
      });
    } catch {
      // Fallback to local purchases
      try {
        const raw = localStorage.getItem('despensa_stock_local_purchases');
        if (raw) {
          purchases = JSON.parse(raw).filter((p: any) => p.providerId === providerId && p.status !== 'CANCELLED');
        }
      } catch {}
    }

    const activePayments = allPayments.filter(p => p.status !== 'CANCELLED');
    const totalPurchased = purchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const totalPaid = activePayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const currentDebt = Math.max(0, totalPurchased - totalPaid);

    return {
      provider,
      totalPurchased,
      totalPaid,
      currentDebt,
      purchases,
      payments: activePayments,
    };
  },

  /**
   * Fetch all providers with their computed financial accounts
   */
  async getAllProvidersWithAccounts(): Promise<Provider[]> {
    const providers = await this.getAllProviders();
    const allPayments = await this.getSupplierPayments();

    // Fetch all active purchases
    let allPurchases: Purchase[] = [];
    try {
      const snap = await getDocs(query(collection(db, PURCHASES_COLLECTION)));
      snap.forEach(d => {
        const data = d.data();
        if (data.status === 'CANCELLED') return;
        allPurchases.push({
          id: d.id,
          providerId: data.providerId,
          providerName: data.providerName,
          totalAmount: data.totalAmount || 0,
          totalItemsCount: data.totalItemsCount || 0,
          items: data.items || [],
          createdAt: data.createdAtIso || new Date().toISOString(),
        });
      });
    } catch {
      try {
        const raw = localStorage.getItem('despensa_stock_local_purchases');
        if (raw) allPurchases = JSON.parse(raw).filter((p: any) => p.status !== 'CANCELLED');
      } catch {}
    }

    const activePayments = allPayments.filter(p => p.status !== 'CANCELLED');

    // Aggregate by providerId
    const purchaseMap = new Map<string, number>();
    allPurchases.forEach(p => {
      const prev = purchaseMap.get(p.providerId) || 0;
      purchaseMap.set(p.providerId, prev + (p.totalAmount || 0));
    });

    const paymentMap = new Map<string, number>();
    activePayments.forEach(pay => {
      const prev = paymentMap.get(pay.providerId) || 0;
      paymentMap.set(pay.providerId, prev + (pay.amount || 0));
    });

    return providers.map(prov => {
      const totalPurchased = purchaseMap.get(prov.id) || 0;
      const totalPaid = paymentMap.get(prov.id) || 0;
      const currentDebt = Math.max(0, totalPurchased - totalPaid);
      return {
        ...prov,
        totalPurchased,
        totalPaid,
        currentDebt,
      };
    });
  }
};
