import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';
import { Customer, CreateCustomerInput } from '../../types/customer';

const CUSTOMERS_COLLECTION = 'customers';
const LOCAL_CUSTOMERS_KEY = 'despensa_stock_local_customers';

function getLocalCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCustomers(customers: Customer[]) {
  try {
    localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(customers));
  } catch (err) {
    console.warn('Error al guardar clientes localmente:', err);
  }
}

export const customerService = {
  /**
   * Fetch all customers from Firestore (or local cache on offline/error)
   */
  async getAllCustomers(): Promise<Customer[]> {
    try {
      const q = query(collection(db, CUSTOMERS_COLLECTION), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const customers: Customer[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        customers.push({
          id: docSnap.id,
          name: data.name || '',
          phone: data.phone || '',
          notes: data.notes || '',
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          updatedAt: data.updatedAtIso || (data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()),
        });
      });

      saveLocalCustomers(customers);
      return customers;
    } catch (err) {
      console.warn('Error al obtener clientes de Firestore, usando cache local:', err);
      return getLocalCustomers();
    }
  },

  /**
   * Get single customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    try {
      const docRef = doc(db, CUSTOMERS_COLLECTION, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: snap.id,
          name: data.name || '',
          phone: data.phone || '',
          notes: data.notes || '',
          createdAt: data.createdAtIso || new Date().toISOString(),
          updatedAt: data.updatedAtIso || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Error al obtener cliente por ID de Firestore:', err);
    }
    const local = getLocalCustomers();
    return local.find((c) => c.id === id) || null;
  },

  /**
   * Search customers by name or phone
   */
  async searchCustomers(searchTerm: string): Promise<Customer[]> {
    const all = await this.getAllCustomers();
    if (!searchTerm || !searchTerm.trim()) return all;

    const term = searchTerm.trim().toLowerCase();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.toLowerCase().includes(term))
    );
  },

  /**
   * Create new customer
   */
  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const cleanName = input.name.trim();
    if (!cleanName) {
      throw new Error('El nombre del cliente es obligatorio.');
    }

    const nowIso = new Date().toISOString();
    const customerId = `cust_${Date.now()}`;

    const newCustomer: Customer = {
      id: customerId,
      name: cleanName,
      phone: input.phone?.trim() || '',
      notes: input.notes?.trim() || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Clean payload for Firestore (no undefined)
    const firestorePayload: Record<string, any> = {
      id: customerId,
      name: cleanName,
      phone: newCustomer.phone,
      notes: newCustomer.notes,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
      await setDoc(docRef, firestorePayload);
    } catch (err) {
      console.warn('Error al guardar cliente en Firestore:', err);
    }

    const local = getLocalCustomers();
    local.push(newCustomer);
    saveLocalCustomers(local);

    return newCustomer;
  },

  /**
   * Update existing customer
   */
  async updateCustomer(id: string, updates: Partial<CreateCustomerInput>): Promise<Customer> {
    const existing = await this.getCustomerById(id);
    if (!existing) {
      throw new Error('Cliente no encontrado.');
    }

    const nowIso = new Date().toISOString();
    const updatedCustomer: Customer = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      phone: updates.phone !== undefined ? updates.phone.trim() : existing.phone,
      notes: updates.notes !== undefined ? updates.notes.trim() : existing.notes,
      updatedAt: nowIso,
    };

    if (!updatedCustomer.name) {
      throw new Error('El nombre del cliente no puede estar vacío.');
    }

    const firestoreUpdates: Record<string, any> = {
      name: updatedCustomer.name,
      phone: updatedCustomer.phone,
      notes: updatedCustomer.notes,
      updatedAtIso: nowIso,
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = doc(db, CUSTOMERS_COLLECTION, id);
      await updateDoc(docRef, firestoreUpdates);
    } catch (err) {
      console.warn('Error al actualizar cliente en Firestore:', err);
    }

    const local = getLocalCustomers();
    const idx = local.findIndex((c) => c.id === id);
    if (idx !== -1) {
      local[idx] = updatedCustomer;
    } else {
      local.push(updatedCustomer);
    }
    saveLocalCustomers(local);

    return updatedCustomer;
  },

  /**
   * Delete customer doc
   */
  async deleteCustomer(id: string): Promise<void> {
    try {
      const docRef = doc(db, CUSTOMERS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Error al eliminar cliente de Firestore:', err);
    }

    const local = getLocalCustomers();
    const filtered = local.filter((c) => c.id !== id);
    saveLocalCustomers(filtered);
  },
};
