import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  runTransaction,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import { Purchase, PurchaseItem, ProcessPurchaseInput } from '../../types/purchase';
import { Product, getProductStock, getTotalStock } from '../../types/product';
import { LocationSelection } from '../../types/location';
import { productService } from './productService';
import { getArgentinaToday, toArgentinaDateString } from '../../utils/dateUtils';

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
   * 1. Updates product stocks for target location and costs/sale prices.
   * 2. Registers purchase and purchase_items in Firestore and Local Cache with locationId.
   */
  async processPurchase(input: ProcessPurchaseInput, locationId: string = 'aimogasta'): Promise<{ purchase: Purchase; updatedProducts: Product[] }> {
    if (!input.providerId || !input.providerName) {
      throw new Error('Debe seleccionar un proveedor válido');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('El ingreso debe contener al menos un producto');
    }

    const targetLocationKey = input.locationId || locationId || 'aimogasta';
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
        locationId: targetLocationKey,
      };

      purchaseItems.push(pItem);

      // Calculate new product stock per location
      const legacyStock = prod.stockQuantity ?? (prod as any).stock ?? 0;
      const currentLocStock = getProductStock(prod, targetLocationKey);
      const newLocStock = currentLocStock + quantity;
      
      const stockByLoc = prod.stockByLocation && typeof prod.stockByLocation === 'object'
        ? { ...prod.stockByLocation, [targetLocationKey]: newLocStock }
        : { aimogasta: targetLocationKey === 'aimogasta' ? legacyStock + quantity : legacyStock, olascoaga: targetLocationKey === 'olascoaga' ? quantity : 0 };

      const newTotalStock = getTotalStock({ ...prod, stockByLocation: stockByLoc });

      const updatedProd: Product = {
        ...prod,
        stockByLocation: stockByLoc,
        stockQuantity: newTotalStock,
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

    const operatingDate = getArgentinaToday();
    const newPurchase: Purchase = {
      id: purchaseId,
      date: operatingDate,
      providerId: input.providerId,
      providerName: input.providerName,
      createdAt: nowIso,
      totalAmount,
      totalItemsCount,
      items: purchaseItems,
      locationId: targetLocationKey,
    };

    // Firestore batch execution
    try {
      const batch = writeBatch(db);

      // 1. Add purchase doc
      const purchaseRef = doc(db, PURCHASES_COLLECTION, purchaseId);
      batch.set(purchaseRef, {
        id: newPurchase.id,
        date: operatingDate,
        providerId: newPurchase.providerId,
        providerName: newPurchase.providerName,
        createdAt: serverTimestamp(),
        createdAtIso: nowIso,
        totalAmount: newPurchase.totalAmount,
        totalItemsCount: newPurchase.totalItemsCount,
        itemsCount: newPurchase.items.length,
        locationId: targetLocationKey,
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
          locationId: targetLocationKey,
        };

        if (pItem.previousCost !== undefined) sanitizedItem.previousCost = pItem.previousCost;
        if (pItem.previousSalePrice !== undefined) sanitizedItem.previousSalePrice = pItem.previousSalePrice;

        batch.set(itemRef, sanitizedItem);
      }

      // 3. Update products docs
      for (const updatedProd of updatedProducts) {
        const prodRef = doc(db, PRODUCTS_COLLECTION, updatedProd.id);
        const prodUpdates: Record<string, any> = {
          stockByLocation: updatedProd.stockByLocation,
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
            stockByLocation: updatedProd.stockByLocation,
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
          locationId: data.locationId || 'aimogasta',
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
  },

  /**
   * Fetch all purchases ordered by date descending, optionally filtered by locationId
   */
  async getPurchases(locationId?: LocationSelection): Promise<Purchase[]> {
    try {
      const q = query(
        collection(db, PURCHASES_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const purchases: Purchase[] = [];
      const local = getLocalPurchases();
      const localMap = new Map<string, Purchase>(local.map((p) => [p.id, p]));

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const purLoc = data.locationId || 'aimogasta';
        if (!locationId || locationId === 'all' || purLoc === locationId) {
          const localMatch = localMap.get(docSnap.id);
          purchases.push({
            id: docSnap.id,
            date: data.date || toArgentinaDateString(data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt) || getArgentinaToday(),
            providerId: data.providerId || '',
            providerName: data.providerName || 'Proveedor',
            locationId: purLoc,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            totalAmount: data.totalAmount || 0,
            totalItemsCount: data.totalItemsCount || data.itemsCount || 0,
            items: (localMatch && localMatch.items && localMatch.items.length > 0) ? localMatch.items : (data.items || []),
            status: data.status || undefined,
            cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
            cancellationReason: data.cancellationReason || undefined,
          });
        }
      });

      // Also merge any local purchases not present in querySnapshot
      for (const locP of local) {
        if (!purchases.some((p) => p.id === locP.id)) {
          const pLoc = locP.locationId || 'aimogasta';
          if (!locationId || locationId === 'all' || pLoc === locationId) {
            purchases.push(locP);
          }
        }
      }

      purchases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      saveLocalPurchases(purchases);
      return purchases;
    } catch (err) {
      console.warn('Error al obtener compras de Firestore, usando cache local:', err);
      const local = getLocalPurchases();
      const filtered = (!locationId || locationId === 'all')
        ? local
        : local.filter((p) => (p.locationId || 'aimogasta') === locationId);
      return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  /**
   * Get single purchase by ID, including its purchase items
   */
  async getPurchaseById(purchaseId: string): Promise<Purchase | null> {
    const local = getLocalPurchases();
    const foundLocal = local.find((p) => p.id === purchaseId);
    if (foundLocal && foundLocal.items && foundLocal.items.length > 0) {
      return foundLocal;
    }

    try {
      const docRef = doc(db, PURCHASES_COLLECTION, purchaseId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Load items for this purchase
        const itemsQuery = query(
          collection(db, PURCHASE_ITEMS_COLLECTION),
          where('purchaseId', '==', purchaseId)
        );
        const itemsSnap = await getDocs(itemsQuery);
        const items: PurchaseItem[] = [];
        itemsSnap.forEach((iSnap) => {
          const iData = iSnap.data();
          items.push({
            id: iSnap.id,
            productId: iData.productId,
            barcode: iData.barcode || '',
            name: iData.name || '',
            brand: iData.brand || '',
            presentation: iData.presentation || '',
            category: iData.category || '',
            providerId: iData.providerId || data.providerId,
            providerName: iData.providerName || data.providerName,
            purchaseId: purchaseId,
            quantity: iData.quantity || 0,
            unitCost: iData.unitCost || 0,
            totalCost: iData.totalCost || 0,
            previousCost: iData.previousCost,
            newCost: iData.newCost || iData.unitCost || 0,
            previousSalePrice: iData.previousSalePrice,
            suggestedSalePrice: iData.suggestedSalePrice || 0,
            finalSalePrice: iData.finalSalePrice || 0,
            purchaseDate: iData.purchaseDate?.toDate ? iData.purchaseDate.toDate().toISOString() : (iData.purchaseDate || data.createdAt || new Date().toISOString()),
            locationId: iData.locationId || data.locationId || 'aimogasta',
          });
        });

        const purchase: Purchase = {
          id: docSnap.id,
          providerId: data.providerId || '',
          providerName: data.providerName || 'Proveedor',
          locationId: data.locationId || 'aimogasta',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          totalAmount: data.totalAmount || 0,
          totalItemsCount: data.totalItemsCount || items.reduce((acc, curr) => acc + (curr.quantity || 0), 0),
          items: items.length > 0 ? items : (foundLocal?.items || []),
          status: data.status || undefined,
          cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
          cancellationReason: data.cancellationReason || undefined,
        };

        return purchase;
      }
    } catch (err) {
      console.warn('Error al obtener compra por ID de Firestore:', err);
    }

    return foundLocal || null;
  },

  /**
   * Atomically cancel a merchandise purchase / income:
   * 1. Checks if purchase is already cancelled.
   * 2. CRITICAL PRE-VALIDATION: Ensures every product has enough stock in the target location
   *    to revert the quantity. If any product has insufficient stock, it rejects the entire operation
   *    with an explanatory message (All-or-Nothing).
   * 3. Atomically subtracts the added stock from each product in Firestore.
   * 4. Marks purchase and associated purchase_items as CANCELLED.
   * 5. Updates local caches.
   */
  async cancelPurchase(purchaseId: string, reason: string): Promise<Purchase> {
    if (!purchaseId) throw new Error('ID de ingreso de mercadería no válido');
    if (!reason?.trim()) throw new Error('Debe proporcionar un motivo de anulación');

    const cleanReason = reason.trim();
    const nowIso = new Date().toISOString();

    // Fetch existing purchase details first
    const purchRef = doc(db, PURCHASES_COLLECTION, purchaseId);
    const existingSnap = await getDoc(purchRef);
    if (!existingSnap.exists()) {
      throw new Error(`No se encontró el ingreso de mercadería (${purchaseId})`);
    }

    const existingData = existingSnap.data();
    if (existingData.status === 'CANCELLED') {
      throw new Error('Este ingreso de mercadería ya fue anulado previamente.');
    }

    // Load items either from purchase document or purchase_items collection
    let items: PurchaseItem[] = existingData.items || [];
    if (items.length === 0) {
      const itemsQ = query(
        collection(db, PURCHASE_ITEMS_COLLECTION),
        where('purchaseId', '==', purchaseId)
      );
      const itemsSnap = await getDocs(itemsQ);
      itemsSnap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
    }

    const locKey = existingData.locationId || 'aimogasta';
    let returnedPurchase: Purchase | null = null;
    const updatedProducts: Product[] = [];

    await runTransaction(db, async (transaction) => {
      // Re-read purchase inside transaction
      const pDoc = await transaction.get(purchRef);
      if (!pDoc.exists()) {
        throw new Error(`No se encontró el ingreso de mercadería (${purchaseId})`);
      }
      if (pDoc.data()?.status === 'CANCELLED') {
        throw new Error('Este ingreso de mercadería ya fue anulado previamente.');
      }

      // Read all products and perform All-or-Nothing stock validation
      const productDocs: { ref: any; item: PurchaseItem; data: Product; currentLocStock: number }[] = [];

      for (const item of items) {
        if (!item.productId) continue;
        const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists()) {
          throw new Error(`El producto con ID "${item.productId}" no existe en el catálogo.`);
        }

        const prodData = prodSnap.data() as Product;
        const currentLocStock = getProductStock(prodData, locKey);

        if (currentLocStock < item.quantity) {
          const locName = locKey === 'olascoaga' ? 'Olascoaga' : 'Aimogasta';
          throw new Error(
            `No es posible anular el ingreso: Stock insuficiente para revertir (se requieren ${item.quantity} unidades de "${prodData.name}", disponibles ${currentLocStock} en ${locName}).`
          );
        }

        productDocs.push({
          ref: prodRef,
          item,
          data: prodData,
          currentLocStock,
        });
      }

      // All products have sufficient stock -> execute writes
      for (const { ref: prodRef, item, data: prodData, currentLocStock } of productDocs) {
        const newLocStock = Math.max(0, currentLocStock - item.quantity);
        const legacyStock = prodData.stockQuantity ?? (prodData as any).stock ?? 0;

        const stockByLocation = prodData.stockByLocation && typeof prodData.stockByLocation === 'object'
          ? { ...prodData.stockByLocation, [locKey]: newLocStock }
          : { 
              aimogasta: locKey === 'aimogasta' ? newLocStock : legacyStock, 
              olascoaga: locKey === 'olascoaga' ? newLocStock : 0 
            };

        const newTotalStock = (stockByLocation.aimogasta || 0) + (stockByLocation.olascoaga || 0);

        transaction.update(prodRef, {
          stockByLocation,
          stockQuantity: newTotalStock,
          updatedAt: serverTimestamp(),
        });

        updatedProducts.push({
          ...prodData,
          stockByLocation,
          stockQuantity: newTotalStock,
          updatedAt: nowIso,
        });
      }

      // Mark purchase as CANCELLED
      transaction.update(purchRef, {
        status: 'CANCELLED',
        cancelledAt: serverTimestamp(),
        cancelledAtIso: nowIso,
        cancellationReason: cleanReason,
      });

      returnedPurchase = {
        id: purchaseId,
        providerId: existingData.providerId || '',
        providerName: existingData.providerName || 'Proveedor',
        locationId: locKey,
        createdAt: existingData.createdAt?.toDate ? existingData.createdAt.toDate().toISOString() : (existingData.createdAt || nowIso),
        totalAmount: existingData.totalAmount || 0,
        totalItemsCount: existingData.totalItemsCount || items.reduce((a, b) => a + (b.quantity || 0), 0),
        items,
        status: 'CANCELLED',
        cancelledAt: nowIso,
        cancellationReason: cleanReason,
      };
    });

    // Update local caches
    if (returnedPurchase) {
      const local = getLocalPurchases();
      const idx = local.findIndex(p => p.id === purchaseId);
      if (idx >= 0) {
        local[idx] = returnedPurchase;
      } else {
        local.unshift(returnedPurchase);
      }
      saveLocalPurchases(local);

      // Update local purchase items
      const localItems = getLocalPurchaseItems();
      let itemsUpdated = false;
      for (const item of localItems) {
        if (item.purchaseId === purchaseId) {
          item.status = 'CANCELLED';
          item.cancelledAt = nowIso;
          item.cancellationReason = cleanReason;
          itemsUpdated = true;
        }
      }
      if (itemsUpdated) {
        saveLocalPurchaseItems(localItems);
      }

      // Update local product cache
      for (const p of updatedProducts) {
        productService.updateLocalProduct(p);
      }
    }

    return returnedPurchase!;
  },
};

