import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';
import { Provider, CreateProviderInput } from '../../types/provider';

const PROVIDERS_COLLECTION = 'providers';
const LOCAL_STORAGE_KEY = 'despensa_stock_local_providers';

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
  }
};
