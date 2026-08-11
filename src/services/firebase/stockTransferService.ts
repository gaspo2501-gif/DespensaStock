import { 
  collection, 
  doc, 
  runTransaction, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';
import { StockTransfer, CreateStockTransferInput } from '../../types/stockTransfer';
import { getLocationName } from '../../types/location';
import { Product } from '../../types/product';
import { productService } from './productService';

const TRANSFERS_COLLECTION = 'stock_transfers';
const PRODUCTS_COLLECTION = 'products';
const LOCAL_TRANSFERS_KEY = 'despensa_stock_local_transfers';

function getLocalTransfers(): StockTransfer[] {
  try {
    const raw = localStorage.getItem(LOCAL_TRANSFERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTransfers(transfers: StockTransfer[]) {
  try {
    localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(transfers));
  } catch (err) {
    console.warn('Failed to save transfers to local backup:', err);
  }
}

export const stockTransferService = {
  /**
   * Transfer product stock atomically from sourceLocationId to destinationLocationId
   */
  async transferStock(input: CreateStockTransferInput): Promise<{ transfer: StockTransfer; updatedProduct: Product }> {
    const { productId, sourceLocationId, destinationLocationId, quantity, notes } = input;

    if (!productId) {
      throw new Error('Debe seleccionar un producto.');
    }
    if (!sourceLocationId || !destinationLocationId) {
      throw new Error('Debe seleccionar la ubicación de origen y destino.');
    }
    if (sourceLocationId === destinationLocationId) {
      throw new Error('La ubicación de origen y destino no pueden ser la misma.');
    }
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error('La cantidad a transferir debe ser mayor a 0.');
    }

    const nowIso = new Date().toISOString();
    const transferId = `trans_${Date.now()}`;
    let updatedProductResult: Product | null = null;
    let transferRecord: StockTransfer | null = null;

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, PRODUCTS_COLLECTION, productId);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error('El producto no existe en la base de datos.');
        }

        const data = productSnap.data();
        const legacyStock = data.stockQuantity ?? data.stock ?? 0;
        const stockByLocation: Record<string, number> = data.stockByLocation
          ? { ...data.stockByLocation }
          : { aimogasta: legacyStock, olascoaga: 0 };

        const sourceStock = stockByLocation[sourceLocationId] ?? (sourceLocationId === 'aimogasta' ? legacyStock : 0);
        if (sourceStock < quantity) {
          throw new Error(
            `Stock insuficiente en ${getLocationName(sourceLocationId)}. Disponible: ${sourceStock}, Requerido: ${quantity}.`
          );
        }

        const destStock = stockByLocation[destinationLocationId] ?? 0;

        stockByLocation[sourceLocationId] = sourceStock - quantity;
        stockByLocation[destinationLocationId] = destStock + quantity;

        const totalStock = Object.values(stockByLocation).reduce((s, q) => s + (typeof q === 'number' && !isNaN(q) ? q : 0), 0);

        transaction.update(productRef, {
          stockByLocation,
          stockQuantity: totalStock,
          stock: totalStock,
          updatedAt: serverTimestamp(),
        });

        const transferRef = doc(db, TRANSFERS_COLLECTION, transferId);
        const transferPayload = {
          id: transferId,
          productId,
          barcode: data.barcode || '',
          productName: data.name || 'Producto',
          quantity,
          sourceLocationId,
          sourceLocationName: getLocationName(sourceLocationId),
          destinationLocationId,
          destinationLocationName: getLocationName(destinationLocationId),
          notes: notes || '',
          createdAtIso: nowIso,
          createdAt: serverTimestamp(),
        };

        transaction.set(transferRef, transferPayload);

        transferRecord = {
          id: transferId,
          productId,
          barcode: data.barcode || '',
          productName: data.name || 'Producto',
          quantity,
          sourceLocationId,
          sourceLocationName: getLocationName(sourceLocationId),
          destinationLocationId,
          destinationLocationName: getLocationName(destinationLocationId),
          createdAt: nowIso,
          notes: notes || '',
        };

        updatedProductResult = {
          id: productSnap.id,
          barcode: data.barcode,
          name: data.name || 'Sin Nombre',
          brand: data.brand || '',
          category: data.category || 'Otros',
          presentation: data.presentation || '',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || nowIso),
          updatedAt: nowIso,
          source: data.source || 'local',
          stockQuantity: totalStock,
          stockByLocation,
          salePrice: data.salePrice,
        };
      });
    } catch (error: any) {
      console.warn('Firestore stock transfer transaction failed or offline:', error);
      if (error?.message && error.message.includes('Stock insuficiente')) {
        throw error;
      }
    }

    // Fallback if transaction didn't finish via online firestore
    if (!transferRecord || !updatedProductResult) {
      // Offline fallback: update stock in source and destination
      const p = await productService.getAllProducts();
      const targetP = p.find(prod => prod.id === productId);
      if (!targetP) throw new Error('Producto no encontrado');

      await productService.updateStock(productId, 'subtract', quantity, sourceLocationId);
      const updated = await productService.updateStock(productId, 'add', quantity, destinationLocationId);

      transferRecord = {
        id: transferId,
        productId,
        barcode: targetP.barcode,
        productName: targetP.name,
        quantity,
        sourceLocationId,
        sourceLocationName: getLocationName(sourceLocationId),
        destinationLocationId,
        destinationLocationName: getLocationName(destinationLocationId),
        createdAt: nowIso,
        notes: notes || '',
      };
      updatedProductResult = updated;
    }

    const localTrans = getLocalTransfers();
    localTrans.unshift(transferRecord);
    saveLocalTransfers(localTrans);

    return {
      transfer: transferRecord,
      updatedProduct: updatedProductResult,
    };
  },

  /**
   * Fetch transfer history
   */
  async getTransferHistory(): Promise<StockTransfer[]> {
    try {
      const q = query(collection(db, TRANSFERS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const transfers: StockTransfer[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        transfers.push({
          id: docSnap.id,
          productId: data.productId,
          barcode: data.barcode || '',
          productName: data.productName || 'Producto',
          quantity: data.quantity || 0,
          sourceLocationId: data.sourceLocationId || 'aimogasta',
          sourceLocationName: data.sourceLocationName || getLocationName(data.sourceLocationId),
          destinationLocationId: data.destinationLocationId || 'olascoaga',
          destinationLocationName: data.destinationLocationName || getLocationName(data.destinationLocationId),
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          notes: data.notes || '',
        });
      });

      saveLocalTransfers(transfers);
      return transfers;
    } catch (err) {
      console.warn('Error fetching transfer history, using local cache:', err);
      return getLocalTransfers();
    }
  },
};
