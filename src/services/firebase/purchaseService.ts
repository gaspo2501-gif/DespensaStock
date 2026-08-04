import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import { Purchase, PurchaseItem, ProcessPurchaseInput } from '../../types/purchase';
import { Product } from '../../types/product';
import { productService } from './productService';

const PURCHASES_COLLECTION = 'purchases';
const PURCHASE_ITEMS_COLLECTION = 'purchase_items';
const PRODUCTS_COLLECTION = 'products';

const LOCAL_PURCHASES_KEY = 'despensa_stock_local_purchases';
const LOCAL_PURCHASE_ITEMS_KEY = 'despensa_stock_local_purchase_items';

function getLocalPurchases(): Purchase[] {
  try {
    const raw = localStorage.getItem(LOCAL_PURCHASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPurchases(purchases: Purchase[]) {
  try {
    localStorage.setItem(LOCAL_PURCHASES_KEY, JSON.stringify(purchases));
  } catch (err) {
    console.warn('Failed to save purchases to localStorage:', err);
  }
}

function getLocalPurchaseItems(): PurchaseItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_PURCHASE_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPurchaseItems(items: PurchaseItem[]) {
  try {
    localStorage.setItem(LOCAL_PURCHASE_ITEMS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save purchase items to localStorage:', err);
  }
}

export const purchaseService = {
  /**
   * Process a complete purchase entry:
   * 1. Updates product stocks and costs/sale prices.
   * 2. Registers purchase and purchase_items in Firestore and Local Cache.
   */
  async processPurchase(input: ProcessPurchaseInput): Promise<{ purchase: Purchase; updatedProducts: Product[] }> {
    if (!input.providerId || !input.providerName) {
      throw new Error('Debe seleccionar un proveedor válido');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('El ingreso debe contener al menos un producto');
    }

    const nowIso = new Date().toISOString();
    const purchaseId = `purch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let totalAmount = 0;
    let totalItemsCount = 0;

    const purchaseItems: PurchaseItem[] = [];
    const updatedProducts: Product[] = [];

    // Construct purchase items and updated product states
    for (const item of input.items) {
      const prod = item.product;
      const quantity = Math.max(1, Math.round(item.quantity));
      const unitCost = Math.max(0, item.unitCost);
      const totalCost = quantity * unitCost;

      totalAmount += totalCost;
      totalItemsCount += quantity;

      const pItem: PurchaseItem = {
        id: `pitem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: prod.id,
        barcode: prod.barcode,
        name: prod.name,
        brand: prod.brand || '',
        presentation: prod.presentation || '',
        category: prod.category || 'Otros',
        providerId: input.providerId,
        providerName: input.providerName,
        purchaseId,
        quantity,
        unitCost,
        totalCost,
        previousCost: item.previousCost ?? prod.currentCost ?? prod.costPrice,
        newCost: unitCost,
        previousSalePrice: item.previousSalePrice ?? prod.salePrice,
        suggestedSalePrice: item.suggestedSalePrice,
        finalSalePrice: item.finalSalePrice,
        purchaseDate: nowIso,
      };

      purchaseItems.push(pItem);

      // Calculate new product stock and metadata
      const currentStock = prod.stockQuantity || 0;
      const newStock = currentStock + quantity;

      const updatedProd: Product = {
        ...prod,
        stockQuantity: newStock,
        currentCost: unitCost,
        lastCost: unitCost,
        costPrice: unitCost,
        salePrice: item.finalSalePrice,
        lastPurchaseDate: nowIso,
        lastSupplierId: input.providerId,
        lastSupplierName: input.providerName,
        updatedAt: nowIso,
      };

      updatedProducts.push(updatedProd);
    }

    const newPurchase: Purchase = {
      id: purchaseId,
      providerId: input.providerId,
      providerName: input.providerName,
      createdAt: nowIso,
      totalAmount,
      totalItemsCount,
      items: purchaseItems,
    };

    // Firestore batch execution
    try {
      const batch = writeBatch(db);

      // 1. Add purchase doc
      const purchaseRef = doc(db, PURCHASES_COLLECTION, purchaseId);
      batch.set(purchaseRef, {
        id: newPurchase.id,
        providerId: newPurchase.providerId,
        providerName: newPurchase.providerName,
        createdAt: serverTimestamp(),
        totalAmount: newPurchase.totalAmount,
        totalItemsCount: newPurchase.totalItemsCount,
        itemsCount: newPurchase.items.length,
      });

      // 2. Add purchase_items docs
      for (const pItem of purchaseItems) {
        const itemRef = doc(db, PURCHASE_ITEMS_COLLECTION, pItem.id!);
        const sanitizedItem: Record<string, any> = {
          id: pItem.id,
          productId: pItem.productId,
          barcode: pItem.barcode,
          name: pItem.name,
          brand: pItem.brand,
          presentation: pItem.presentation,
          category: pItem.category,
          providerId: pItem.providerId,
          providerName: pItem.providerName,
          purchaseId: pItem.purchaseId,
          quantity: pItem.quantity,
          unitCost: pItem.unitCost,
          totalCost: pItem.totalCost,
          newCost: pItem.newCost,
          suggestedSalePrice: pItem.suggestedSalePrice,
          finalSalePrice: pItem.finalSalePrice,
          purchaseDate: serverTimestamp(),
        };

        if (pItem.previousCost !== undefined) sanitizedItem.previousCost = pItem.previousCost;
        if (pItem.previousSalePrice !== undefined) sanitizedItem.previousSalePrice = pItem.previousSalePrice;

        batch.set(itemRef, sanitizedItem);
      }

      // 3. Update products docs
      for (const updatedProd of updatedProducts) {
        const prodRef = doc(db, PRODUCTS_COLLECTION, updatedProd.id);
        const prodUpdates: Record<string, any> = {
          stockQuantity: updatedProd.stockQuantity,
          stock: updatedProd.stockQuantity,
          currentCost: updatedProd.currentCost,
          lastCost: updatedProd.lastCost,
          costPrice: updatedProd.costPrice,
          salePrice: updatedProd.salePrice,
          lastPurchaseDate: serverTimestamp(),
          lastSupplierId: updatedProd.lastSupplierId,
          lastSupplierName: updatedProd.lastSupplierName,
          updatedAt: serverTimestamp(),
        };

        batch.update(prodRef, prodUpdates);
      }

      await batch.commit();
    } catch (error) {
      console.warn('Error committing purchase batch to Firestore, applying fallback:', error);
      // Fallback: update individual products via productService
      for (const updatedProd of updatedProducts) {
        try {
          await productService.updateProduct(updatedProd.id, {
            stockQuantity: updatedProd.stockQuantity,
            salePrice: updatedProd.salePrice,
            currentCost: updatedProd.currentCost,
            lastCost: updatedProd.lastCost,
            costPrice: updatedProd.costPrice,
            lastPurchaseDate: nowIso,
            lastSupplierId: updatedProd.lastSupplierId,
            lastSupplierName: updatedProd.lastSupplierName,
          });
        } catch (err) {
          console.warn(`Failed fallback update for product ${updatedProd.id}:`, err);
        }
      }
    }

    // Save to local storage caches
    const localPurchases = getLocalPurchases();
    localPurchases.unshift(newPurchase);
    saveLocalPurchases(localPurchases);

    const localPurchaseItems = getLocalPurchaseItems();
    saveLocalPurchaseItems([...purchaseItems, ...localPurchaseItems]);

    return {
      purchase: newPurchase,
      updatedProducts,
    };
  },

  /**
   * Fetch cost history for a specific product
   */
  async getCostHistoryForProduct(productId: string): Promise<{
    items: PurchaseItem[];
    lastPurchase: PurchaseItem | null;
    bestCost: PurchaseItem | null;
  }> {
    let items: PurchaseItem[] = [];

    try {
      const q = query(
        collection(db, PURCHASE_ITEMS_COLLECTION),
        where('productId', '==', productId)
      );
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          productId: data.productId,
          barcode: data.barcode,
          name: data.name,
          brand: data.brand || '',
          presentation: data.presentation || '',
          category: data.category || '',
          providerId: data.providerId,
          providerName: data.providerName || 'Proveedor',
          purchaseId: data.purchaseId,
          quantity: data.quantity || 0,
          unitCost: data.unitCost || 0,
          totalCost: data.totalCost || 0,
          previousCost: data.previousCost,
          newCost: data.newCost || data.unitCost || 0,
          previousSalePrice: data.previousSalePrice,
          suggestedSalePrice: data.suggestedSalePrice || 0,
          finalSalePrice: data.finalSalePrice || 0,
          purchaseDate: data.purchaseDate?.toDate ? data.purchaseDate.toDate().toISOString() : (data.purchaseDate || new Date().toISOString()),
        });
      });
    } catch (err) {
      console.warn('Firestore purchase_items query error, fallback to local:', err);
      const local = getLocalPurchaseItems();
      items = local.filter(i => i.productId === productId);
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

    const lastPurchase = items.length > 0 ? items[0] : null;

    // Find best cost (lowest unitCost > 0)
    let bestCost: PurchaseItem | null = null;
    for (const item of items) {
      if (item.unitCost > 0) {
        if (!bestCost || item.unitCost < bestCost.unitCost) {
          bestCost = item;
        }
      }
    }

    return {
      items,
      lastPurchase,
      bestCost,
    };
  }
};
