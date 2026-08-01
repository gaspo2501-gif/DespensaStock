import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  getDocs, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './config';
import { CartItem, SaleRecord, SaleItemRecord, PaymentMethod } from '../../types/sale';
import { Product } from '../../types/product';
import { productService } from './productService';
import { accountService } from './accountService';

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';
const MOVEMENTS_COLLECTION = 'account_movements';
const LOCAL_SALES_KEY = 'despensa_stock_local_sales';

function getLocalSales(): SaleRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_SALES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSales(sales: SaleRecord[]) {
  try {
    localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify(sales));
  } catch (err) {
    console.warn('Error al guardar ventas localmente:', err);
  }
}

export const salesService = {
  /**
   * Process and confirm a sale transaction atomically in Firestore.
   * Validates stock for all items, creates the sale record, deducts product stock safely,
   * and registers customer debt if payment method is 'credit' (fiado).
   */
  async processSale(
    cartItems: CartItem[], 
    paymentMethod: PaymentMethod = 'cash', 
    customerId?: string, 
    customerName?: string
  ): Promise<{ sale: SaleRecord; updatedProducts: Product[] }> {
    if (!cartItems || cartItems.length === 0) {
      throw new Error('El carrito de ventas está vacío.');
    }

    if (paymentMethod === 'credit' && !customerId) {
      throw new Error('Seleccioná o creá un cliente para continuar.');
    }

    // 1. Pre-validation on client side
    for (const item of cartItems) {
      if (item.quantity <= 0) {
        throw new Error(`La cantidad para '${item.product.name}' debe ser al menos 1.`);
      }
      if (item.quantity > (item.product.stockQuantity || 0)) {
        throw new Error(
          `Stock insuficiente para '${item.product.name}'. Disponible: ${item.product.stockQuantity || 0} unidades, Solicitado: ${item.quantity}.`
        );
      }
    }

    const updatedProducts: Product[] = [];
    const saleItemsRecords: SaleItemRecord[] = cartItems.map((item) => ({
      productId: item.product.id,
      barcode: item.product.barcode,
      name: item.product.name,
      brand: item.product.brand || '',
      presentation: item.product.presentation || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.quantity * item.unitPrice,
    }));

    const totalAmount = saleItemsRecords.reduce((acc, curr) => acc + curr.subtotal, 0);
    const totalItemsCount = saleItemsRecords.reduce((acc, curr) => acc + curr.quantity, 0);
    const nowIso = new Date().toISOString();
    const saleId = `sale_${Date.now()}`;

    const newSaleRecord: SaleRecord = {
      id: saleId,
      createdAt: nowIso,
      items: saleItemsRecords,
      totalAmount,
      totalItemsCount,
      paymentMethod,
      customerId: customerId || undefined,
      customerName: customerName || undefined,
    };

    let transactionSucceeded = false;

    // 2. Execute atomic Firestore transaction
    try {
      await runTransaction(db, async (transaction) => {
        // Step A: Read all product docs to verify current stock in database
        const productReads: { ref: ReturnType<typeof doc>; data: any; item: CartItem }[] = [];

        for (const item of cartItems) {
          const productRef = doc(db, PRODUCTS_COLLECTION, item.product.id);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`El producto '${item.product.name}' no fue encontrado en la base de datos.`);
          }

          const data = productSnap.data();
          const currentStock = data.stockQuantity ?? data.stock ?? 0;

          if (currentStock < item.quantity) {
            throw new Error(
              `Stock insuficiente en base de datos para '${item.product.name}'. Disponible: ${currentStock}, Solicitado: ${item.quantity}.`
            );
          }

          productReads.push({ ref: productRef, data, item });
        }

        // Step B: Write stock deductions
        for (const { ref, data, item } of productReads) {
          const currentStock = data.stockQuantity ?? data.stock ?? 0;
          const newStock = currentStock - item.quantity;

          transaction.update(ref, {
            stockQuantity: newStock,
            stock: newStock,
            updatedAt: serverTimestamp(),
          });

          updatedProducts.push({
            ...item.product,
            stockQuantity: newStock,
            updatedAt: nowIso,
          });
        }

        // Step C: Write sale record document
        const saleRef = doc(db, SALES_COLLECTION, saleId);
        const salePayload: Record<string, any> = {
          id: saleId,
          createdAt: serverTimestamp(),
          createdAtIso: nowIso,
          items: saleItemsRecords,
          totalAmount,
          totalItemsCount,
          paymentMethod,
        };
        if (customerId) salePayload.customerId = customerId;
        if (customerName) salePayload.customerName = customerName;

        transaction.set(saleRef, salePayload);

        // Step D: Write DEBT movement in account_movements if paymentMethod === 'credit'
        if (paymentMethod === 'credit' && customerId) {
          const movId = `mov_debt_${Date.now()}`;
          const movRef = doc(db, MOVEMENTS_COLLECTION, movId);
          transaction.set(movRef, {
            id: movId,
            customerId,
            type: 'DEBT',
            amount: totalAmount,
            description: 'Venta fiada',
            saleId,
            createdAtIso: nowIso,
            createdAt: serverTimestamp(),
          });
        }
      });

      transactionSucceeded = true;
    } catch (err: unknown) {
      console.warn('Transacción de Firestore falló o se ejecutó sin conexión:', err);
      if (err instanceof Error && (err.message.includes('Stock insuficiente') || err.message.includes('cliente'))) {
        throw err;
      }
    }

    // If transaction didn't run via online Firestore (e.g. offline cache), deduct stock via productService
    if (!transactionSucceeded || updatedProducts.length === 0) {
      updatedProducts.length = 0; // reset
      for (const item of cartItems) {
        const updated = await productService.updateStock(item.product.id, 'subtract', item.quantity);
        updatedProducts.push(updated);
      }

      if (paymentMethod === 'credit' && customerId) {
        await accountService.registerDebt(customerId, totalAmount, 'Venta fiada', saleId);
      }
    }

    // Save to local backup
    const localSales = getLocalSales();
    localSales.unshift(newSaleRecord);
    saveLocalSales(localSales);

    return {
      sale: newSaleRecord,
      updatedProducts,
    };
  },

  /**
   * Fetch historical sales records from Firestore
   */
  async getRecentSales(): Promise<SaleRecord[]> {
    try {
      const q = query(collection(db, SALES_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const sales: SaleRecord[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        sales.push({
          id: docSnap.id,
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          items: data.items || [],
          totalAmount: data.totalAmount || 0,
          totalItemsCount: data.totalItemsCount || 0,
          paymentMethod: data.paymentMethod || 'cash',
          customerId: data.customerId || undefined,
          customerName: data.customerName || undefined,
        });
      });

      saveLocalSales(sales);
      return sales;
    } catch (err) {
      console.warn('Error al obtener ventas de Firestore, usando cache local:', err);
      return getLocalSales();
    }
  },
};
