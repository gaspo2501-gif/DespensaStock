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
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import { Product, CreateProductInput, StockOperation } from '../../types/product';

const PRODUCTS_COLLECTION = 'products';
const LOCAL_STORAGE_KEY = 'despensa_stock_local_products';

// Helper for local storage backup synchronization
function getLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalProducts(products: Product[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
  } catch (err) {
    console.warn('Failed to save to localStorage backup:', err);
  }
}

export const productService = {
  /**
   * Search for a product by barcode in Firestore database
   */
  async getByBarcode(barcode: string): Promise<Product | null> {
    const cleanedBarcode = barcode.trim();
    if (!cleanedBarcode) return null;

    try {
      const q = query(
        collection(db, PRODUCTS_COLLECTION),
        where('barcode', '==', cleanedBarcode)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        return {
          id: docSnap.id,
          barcode: data.barcode,
          name: data.name || 'Sin Nombre',
          brand: data.brand || '',
          category: data.category || 'Otros',
          presentation: data.presentation || '',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
          source: data.source || 'local',
          stockQuantity: data.stockQuantity ?? data.stock ?? 0,
          salePrice: data.salePrice ?? data.price ?? undefined,
          costPrice: data.costPrice ?? data.currentCost ?? data.lastCost ?? undefined,
          currentCost: data.currentCost ?? data.lastCost ?? data.costPrice ?? undefined,
          lastCost: data.lastCost ?? data.currentCost ?? data.costPrice ?? undefined,
          lastPurchaseDate: data.lastPurchaseDate?.toDate ? data.lastPurchaseDate.toDate().toISOString() : (data.lastPurchaseDate || undefined),
          lastSupplierId: data.lastSupplierId || undefined,
          lastSupplierName: data.lastSupplierName || undefined,
        };
      }
    } catch (error) {
      console.warn('Firestore query error, trying local fallback:', error);
    }

    // Fallback check in local cache
    const local = getLocalProducts();
    const found = local.find(p => p.barcode === cleanedBarcode);
    return found || null;
  },

  /**
   * Fetch all products stored in Firebase
   */
  async getAllProducts(): Promise<Product[]> {
    try {
      const q = query(collection(db, PRODUCTS_COLLECTION));
      const querySnapshot = await getDocs(q);
      const products: Product[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        products.push({
          id: docSnap.id,
          barcode: data.barcode,
          name: data.name || 'Sin Nombre',
          brand: data.brand || '',
          category: data.category || 'Otros',
          presentation: data.presentation || '',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
          source: data.source || 'local',
          stockQuantity: data.stockQuantity ?? data.stock ?? 0,
          salePrice: data.salePrice ?? data.price ?? undefined,
          costPrice: data.costPrice ?? data.currentCost ?? data.lastCost ?? undefined,
          currentCost: data.currentCost ?? data.lastCost ?? data.costPrice ?? undefined,
          lastCost: data.lastCost ?? data.currentCost ?? data.costPrice ?? undefined,
          lastPurchaseDate: data.lastPurchaseDate?.toDate ? data.lastPurchaseDate.toDate().toISOString() : (data.lastPurchaseDate || undefined),
          lastSupplierId: data.lastSupplierId || undefined,
          lastSupplierName: data.lastSupplierName || undefined,
        });
      });

      // Merge and update local cache
      saveLocalProducts(products);

      // Sort alphabetically by name
      return products.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    } catch (error) {
      console.warn('Error reading from Firestore, using local fallback:', error);
      const local = getLocalProducts();
      return local.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }
  },

  /**
   * Save a new product in Firestore after verifying unique barcode
   */
  async saveProduct(input: CreateProductInput): Promise<Product> {
    const cleanedBarcode = input.barcode.trim();
    if (!cleanedBarcode) {
      throw new Error('El código de barras es obligatorio');
    }
    if (!input.name.trim()) {
      throw new Error('El nombre del producto es obligatorio');
    }

    // Verify barcode does not already exist
    const existing = await this.getByBarcode(cleanedBarcode);
    if (existing) {
      throw new Error(`Ya existe un producto registrado con el código de barras ${cleanedBarcode} ("${existing.name}")`);
    }

    const nowIso = new Date().toISOString();
    // Generate document ID from barcode or auto timestamp
    const docId = `prod_${cleanedBarcode}_${Date.now()}`;
    const initialStock = typeof input.stockQuantity === 'number' && !isNaN(input.stockQuantity) && input.stockQuantity >= 0 ? input.stockQuantity : 0;

    const newProduct: Product = {
      id: docId,
      barcode: cleanedBarcode,
      name: input.name.trim(),
      brand: input.brand?.trim() || '',
      category: input.category?.trim() || 'Otros',
      presentation: input.presentation?.trim() || '',
      description: input.description?.trim() || '',
      imageUrl: input.imageUrl?.trim() || '',
      createdAt: nowIso,
      updatedAt: nowIso,
      source: input.source || 'manual',
      stockQuantity: initialStock,
      salePrice: input.salePrice,
    };

    const docData: Record<string, any> = {
      barcode: newProduct.barcode,
      name: newProduct.name,
      brand: newProduct.brand,
      category: newProduct.category,
      presentation: newProduct.presentation,
      description: newProduct.description,
      imageUrl: newProduct.imageUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: newProduct.source,
      stockQuantity: initialStock,
      stock: initialStock,
    };

    if (typeof input.salePrice === 'number' && !isNaN(input.salePrice) && input.salePrice >= 0) {
      docData.salePrice = input.salePrice;
    }

    try {
      const docRef = doc(db, PRODUCTS_COLLECTION, docId);
      await setDoc(docRef, docData);
    } catch (error) {
      console.warn('Error saving to Firestore, saved to local cache:', error);
    }

    // Always update local cache
    const currentLocal = getLocalProducts().filter(p => p.barcode !== cleanedBarcode);
    currentLocal.push(newProduct);
    saveLocalProducts(currentLocal);

    return newProduct;
  },

  /**
   * Update product stock safely (add, subtract, set)
   */
  async updateStock(productId: string, operation: StockOperation, quantity: number): Promise<Product> {
    if (isNaN(quantity) || quantity < 0) {
      throw new Error('La cantidad ingresada debe ser un número válido mayor o igual a cero');
    }

    let currentProduct: Product | null = null;

    try {
      const docRef = doc(db, PRODUCTS_COLLECTION, productId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        currentProduct = {
          id: docSnap.id,
          barcode: data.barcode,
          name: data.name || 'Sin Nombre',
          brand: data.brand || '',
          category: data.category || 'Otros',
          presentation: data.presentation || '',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
          source: data.source || 'local',
          stockQuantity: data.stockQuantity ?? data.stock ?? 0,
        };
      }
    } catch (err) {
      console.warn('Error fetching product for stock update from Firestore:', err);
    }

    if (!currentProduct) {
      const local = getLocalProducts();
      currentProduct = local.find(p => p.id === productId) || null;
    }

    if (!currentProduct) {
      throw new Error('Producto no encontrado para actualizar el stock');
    }

    const currentStock = currentProduct.stockQuantity || 0;
    let newStock = currentStock;

    if (operation === 'add') {
      newStock = currentStock + quantity;
    } else if (operation === 'subtract') {
      if (currentStock - quantity < 0) {
        throw new Error(`No es posible restar ${quantity} unidades. El stock actual es ${currentStock} y no puede resultar negativo.`);
      }
      newStock = currentStock - quantity;
    } else if (operation === 'set') {
      newStock = quantity;
    }

    const nowIso = new Date().toISOString();

    try {
      const docRef = doc(db, PRODUCTS_COLLECTION, productId);
      await updateDoc(docRef, {
        stockQuantity: newStock,
        stock: newStock,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn('Error updating stock in Firestore, updated local cache:', error);
    }

    const updatedProduct: Product = {
      ...currentProduct,
      stockQuantity: newStock,
      updatedAt: nowIso,
    };

    const local = getLocalProducts();
    const idx = local.findIndex(p => p.id === productId);
    if (idx !== -1) {
      local[idx] = updatedProduct;
    } else {
      local.push(updatedProduct);
    }
    saveLocalProducts(local);

    return updatedProduct;
  },

  /**
   * Update existing product
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const nowIso = new Date().toISOString();
    
    const firestoreUpdates: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    Object.entries(updates).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        if (key === 'salePrice') {
          if (typeof val === 'number' && !isNaN(val) && val >= 0) {
            firestoreUpdates.salePrice = val;
          }
        } else if (key === 'stockQuantity') {
          if (typeof val === 'number' && !isNaN(val) && val >= 0) {
            firestoreUpdates.stockQuantity = val;
            firestoreUpdates.stock = val;
          }
        } else {
          firestoreUpdates[key] = val;
        }
      }
    });

    try {
      const docRef = doc(db, PRODUCTS_COLLECTION, id);
      await setDoc(docRef, firestoreUpdates, { merge: true });
    } catch (error) {
      console.warn('Error updating Firestore doc:', error);
    }

    const local = getLocalProducts();
    const index = local.findIndex(p => p.id === id);
    let baseProduct: Product;

    if (index !== -1) {
      baseProduct = local[index];
    } else {
      baseProduct = {
        id,
        barcode: updates.barcode || '',
        name: updates.name || 'Producto',
        brand: updates.brand || '',
        category: updates.category || 'Otros',
        presentation: updates.presentation || '',
        description: updates.description || '',
        imageUrl: updates.imageUrl || '',
        createdAt: nowIso,
        updatedAt: nowIso,
        source: updates.source || 'manual',
        stockQuantity: updates.stockQuantity ?? 0,
        salePrice: updates.salePrice,
      };
    }

    const cleanUpdates: Partial<Product> = {};
    Object.entries(updates).forEach(([k, v]) => {
      if (v !== undefined) {
        (cleanUpdates as any)[k] = v;
      } else if (k === 'salePrice') {
        // Explicitly clear salePrice if undefined
        delete (cleanUpdates as any).salePrice;
        delete (baseProduct as any).salePrice;
      }
    });

    const updatedProduct: Product = {
      ...baseProduct,
      ...cleanUpdates,
      updatedAt: nowIso,
    };

    if (index !== -1) {
      local[index] = updatedProduct;
    } else {
      local.push(updatedProduct);
    }
    saveLocalProducts(local);

    return updatedProduct;
  },

  /**
   * Delete product by ID
   */
  async deleteProduct(id: string): Promise<void> {
    try {
      const docRef = doc(db, PRODUCTS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.warn('Error deleting from Firestore:', error);
    }

    const local = getLocalProducts().filter(p => p.id !== id);
    saveLocalProducts(local);
  },

  /**
   * Search products locally or in memory by query
   */
  async searchProducts(searchTerm: string): Promise<Product[]> {
    const term = searchTerm.trim().toLowerCase();
    const all = await this.getAllProducts();

    if (!term) return all;

    return all.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  }
};
