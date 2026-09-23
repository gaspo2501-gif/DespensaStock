import { 
  collection, 
  doc, 
  getDoc,
  runTransaction, 
  serverTimestamp, 
  getDocs, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from './config';
import { CartItem, SaleRecord, SaleItemRecord, PaymentMethod } from '../../types/sale';
import { Product, getProductStock } from '../../types/product';
import { LocationSelection, getLocationName } from '../../types/location';
import { productService } from './productService';
import { accountService } from './accountService';
import { cashService } from './cashService';
import { toArgentinaDateString, getArgentinaToday } from '../../utils/dateUtils';

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
   * Validates stock for all items at target location, creates sale record with locationId,
   * deducts product stock for target location safely, registers cash movement,
   * and registers customer debt if payment method is 'credit' (fiado).
   */
  async processSale(
    cartItems: CartItem[], 
    paymentMethod: PaymentMethod = 'cash', 
    customerId?: string, 
    customerName?: string,
    locationId: string = 'aimogasta'
  ): Promise<{ sale: SaleRecord; updatedProducts: Product[] }> {
    if (!cartItems || cartItems.length === 0) {
      throw new Error('El carrito de ventas está vacío.');
    }

    if (paymentMethod === 'credit' && !customerId) {
      throw new Error('Seleccioná o creá un cliente para continuar.');
    }

    const targetLocationKey = locationId === 'olascoaga' ? 'olascoaga' : 'aimogasta';

    // 1. Pre-validation on client side per location
    for (const item of cartItems) {
      if (item.quantity <= 0) {
        throw new Error(`La cantidad para '${item.product.name}' debe ser al menos 1.`);
      }
      const locStock = getProductStock(item.product, targetLocationKey);
      if (item.quantity > locStock) {
        throw new Error(
          `Stock insuficiente para '${item.product.name}' en ${getLocationName(targetLocationKey)}. Disponible: ${locStock} unidades, Solicitado: ${item.quantity}.`
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
    const operatingDate = getArgentinaToday();
    const nowIso = new Date().toISOString();
    const saleId = `sale_${Date.now()}`;

    const newSaleRecord: SaleRecord = {
      id: saleId,
      date: operatingDate,
      createdAt: nowIso,
      items: saleItemsRecords,
      totalAmount,
      totalItemsCount,
      paymentMethod,
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      locationId: targetLocationKey,
    };

    let transactionSucceeded = false;

    // 2. Execute atomic Firestore transaction
    try {
      await runTransaction(db, async (transaction) => {
        // Step A: Read all product docs to verify current stock in target location
        const productReads: { ref: ReturnType<typeof doc>; data: any; item: CartItem }[] = [];

        for (const item of cartItems) {
          const productRef = doc(db, PRODUCTS_COLLECTION, item.product.id);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`El producto '${item.product.name}' no fue encontrado en la base de datos.`);
          }

          const data = productSnap.data();
          const legacyStock = data.stockQuantity ?? data.stock ?? 0;
          const stockByLoc = data.stockByLocation && typeof data.stockByLocation === 'object'
            ? { ...data.stockByLocation }
            : { aimogasta: legacyStock, olascoaga: 0 };

          const currentStock = stockByLoc[targetLocationKey] ?? (targetLocationKey === 'aimogasta' ? legacyStock : 0);

          if (currentStock < item.quantity) {
            throw new Error(
              `Stock insuficiente en base de datos para '${item.product.name}' en ${getLocationName(targetLocationKey)}. Disponible: ${currentStock}, Solicitado: ${item.quantity}.`
            );
          }

          productReads.push({ ref: productRef, data, item });
        }

        // Step B: Write stock deductions for target location
        for (const { ref, data, item } of productReads) {
          const legacyStock = data.stockQuantity ?? data.stock ?? 0;
          const stockByLoc = data.stockByLocation && typeof data.stockByLocation === 'object'
            ? { ...data.stockByLocation }
            : { aimogasta: legacyStock, olascoaga: 0 };

          const currentStock = stockByLoc[targetLocationKey] ?? (targetLocationKey === 'aimogasta' ? legacyStock : 0);
          stockByLoc[targetLocationKey] = currentStock - item.quantity;

          const newTotalStock = (Object.values(stockByLoc) as any[]).reduce<number>(
            (s, q) => s + (typeof q === 'number' && !isNaN(q) ? q : 0),
            0
          );

          transaction.update(ref, {
            stockByLocation: stockByLoc,
            stockQuantity: newTotalStock,
            stock: newTotalStock,
            updatedAt: serverTimestamp(),
          });

          updatedProducts.push({
            ...item.product,
            stockByLocation: stockByLoc,
            stockQuantity: newTotalStock,
            updatedAt: nowIso,
          });
        }

        // Step C: Write sale record document with locationId
        const saleRef = doc(db, SALES_COLLECTION, saleId);
        const salePayload: Record<string, any> = {
          id: saleId,
          date: operatingDate,
          createdAt: serverTimestamp(),
          createdAtIso: nowIso,
          items: saleItemsRecords,
          totalAmount,
          totalItemsCount,
          paymentMethod,
          locationId: targetLocationKey,
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
            locationId: targetLocationKey,
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
        const updated = await productService.updateStock(item.product.id, 'subtract', item.quantity, targetLocationKey);
        updatedProducts.push(updated);
      }

      if (paymentMethod === 'credit' && customerId) {
        await accountService.registerDebt(customerId, totalAmount, 'Venta fiada', saleId, targetLocationKey);
      }
    }

    // Auto-register cash movement for cash/mercado_pago/transfer sales
    if (paymentMethod !== 'credit') {
      try {
        const pm = paymentMethod === 'mercado_pago' ? 'mercado_pago' : 'cash';
        await cashService.registerMovement({
          type: 'INCOME',
          amount: totalAmount,
          paymentMethod: pm,
          description: `Venta #${saleId.slice(-6)} (${getLocationName(targetLocationKey)})`,
          date: operatingDate,
          sourceType: 'SALE',
          sourceId: saleId,
          locationId: targetLocationKey,
        });
      } catch (err) {
        console.warn('Failed auto cash registration for sale:', err);
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
   * Fetch historical sales records from Firestore, filtered optionally by locationId
   */
  async getRecentSales(locationId?: LocationSelection): Promise<SaleRecord[]> {
    try {
      const q = query(collection(db, SALES_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const sales: SaleRecord[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const saleLocation = data.locationId || 'aimogasta'; // default legacy sales to aimogasta

        if (!locationId || locationId === 'all' || saleLocation === locationId) {
          sales.push({
            id: docSnap.id,
            date: data.date || toArgentinaDateString(data.createdAtIso || data.createdAt) || getArgentinaToday(),
            createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
            items: data.items || [],
            totalAmount: data.totalAmount || 0,
            totalItemsCount: data.totalItemsCount || 0,
            paymentMethod: data.paymentMethod || 'cash',
            customerId: data.customerId || undefined,
            customerName: data.customerName || undefined,
            locationId: saleLocation,
            status: data.status || undefined,
            cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
            cancellationReason: data.cancellationReason || undefined,
          });
        }
      });

      saveLocalSales(sales);
      return sales;
    } catch (err) {
      console.warn('Error al obtener ventas de Firestore, usando cache local:', err);
      const local = getLocalSales();
      if (!locationId || locationId === 'all') return local;
      return local.filter(s => (s.locationId || 'aimogasta') === locationId);
    }
  },

  /**
   * Get a single sale by ID from Firestore or local cache
   */
  async getSaleById(saleId: string): Promise<SaleRecord | null> {
    try {
      const docRef = doc(db, SALES_COLLECTION, saleId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          items: data.items || [],
          totalAmount: data.totalAmount || 0,
          totalItemsCount: data.totalItemsCount || 0,
          paymentMethod: data.paymentMethod || 'cash',
          customerId: data.customerId || undefined,
          customerName: data.customerName || undefined,
          locationId: data.locationId || 'aimogasta',
          status: data.status || undefined,
          cancelledAt: data.cancelledAtIso || (data.cancelledAt?.toDate ? data.cancelledAt.toDate().toISOString() : undefined),
          cancellationReason: data.cancellationReason || undefined,
        };
      }
    } catch (err) {
      console.warn('Error al obtener venta de Firestore:', err);
    }
    const local = getLocalSales();
    return local.find((s) => s.id === saleId) || null;
  },

  /**
   * Cancel an existing sale atomically:
   * 1. Checks if already cancelled (idempotency & concurrency guard).
   * 2. Restores product stocks in the original branch.
   * 3. Cancels the associated cash movement (if cash/mercado_pago/transfer) or debt movement (if fiado).
   * 4. Updates sale status to CANCELLED with cancelledAt and reason.
   */
  async cancelSale(saleId: string, reason: string): Promise<SaleRecord> {
    if (!saleId) throw new Error('ID de venta no válido');
    if (!reason?.trim()) throw new Error('Debe proporcionar un motivo de anulación');

    const nowIso = new Date().toISOString();
    const cleanReason = reason.trim();

    // If fiado (credit), search for the debt movement in account_movements first
    const debtQ = query(
      collection(db, MOVEMENTS_COLLECTION), 
      where('saleId', '==', saleId),
      where('type', '==', 'DEBT')
    );
    const debtSnap = await getDocs(debtQ);
    let targetDebtDocRef: any = null;
    if (!debtSnap.empty) {
      if (debtSnap.docs.length > 1) {
        throw new Error('Se encontraron múltiples movimientos de deuda para esta venta. Por seguridad, la operación no puede revertirse automáticamente.');
      }
      targetDebtDocRef = debtSnap.docs[0].ref;
    }

    // Look up potential cash movement document
    const cashMovDocRef = doc(db, 'cash_movements', `mov_cash_sale_${saleId}`);
    let existingCashMovRef: any = null;
    const cashDocDirect = await getDoc(cashMovDocRef);
    if (cashDocDirect.exists()) {
      existingCashMovRef = cashMovDocRef;
    } else {
      const cashQ = query(
        collection(db, 'cash_movements'),
        where('sourceType', '==', 'SALE'),
        where('sourceId', '==', saleId)
      );
      const cashSnap = await getDocs(cashQ);
      if (!cashSnap.empty) {
        existingCashMovRef = cashSnap.docs[0].ref;
      }
    }

    let returnedSaleRecord: SaleRecord | null = null;
    const restoredProducts: Product[] = [];

    await runTransaction(db, async (transaction) => {
      // 1. Read sale document
      const saleRef = doc(db, SALES_COLLECTION, saleId);
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error(`No se encontró el comprobante de venta (${saleId})`);
      }

      const saleData = saleDoc.data();
      if (saleData.status === 'CANCELLED') {
        throw new Error('Esta venta ya fue anulada previamente');
      }

      const paymentMethod = saleData.paymentMethod || 'cash';
      const locKey = saleData.locationId || 'aimogasta';
      const items: SaleItemRecord[] = saleData.items || [];

      // If fiado sale, verify that debt movement was found
      if (paymentMethod === 'credit') {
        if (!targetDebtDocRef) {
          throw new Error('No se puede identificar inequívocamente el movimiento de deuda correspondiente a esta venta fiada para revertirla de forma segura.');
        }
        const debtDocSnap = await transaction.get(targetDebtDocRef);
        if ((debtDocSnap.data() as any)?.status === 'CANCELLED') {
          throw new Error('El movimiento de deuda asociado a esta venta ya fue anulado previamente.');
        }
      }

      // Check cash movement if present
      let cashSnapInTx: any = null;
      if (existingCashMovRef) {
        cashSnapInTx = await transaction.get(existingCashMovRef);
      }

      // Read product documents inside transaction
      const prodDocs: { ref: any; item: SaleItemRecord; data: Product }[] = [];
      for (const item of items) {
        if (!item.productId) continue;
        const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const pSnap = await transaction.get(prodRef);
        if (pSnap.exists()) {
          prodDocs.push({
            ref: prodRef,
            item,
            data: pSnap.data() as Product,
          });
        }
      }

      // --- WRITES (Atomics) ---
      // A: Restore stock for each product in original location
      for (const { ref: prodRef, item, data: prodData } of prodDocs) {
        const legacyStock = prodData.stockQuantity ?? (prodData as any).stock ?? 0;
        const currentLocStock = getProductStock(prodData, locKey);
        const restoredLocStock = currentLocStock + (item.quantity || 0);

        const stockByLocation = prodData.stockByLocation && typeof prodData.stockByLocation === 'object'
          ? { ...prodData.stockByLocation, [locKey]: restoredLocStock }
          : { 
              aimogasta: locKey === 'aimogasta' ? legacyStock + (item.quantity || 0) : legacyStock, 
              olascoaga: locKey === 'olascoaga' ? (item.quantity || 0) : 0 
            };

        const newTotalStock = (stockByLocation.aimogasta || 0) + (stockByLocation.olascoaga || 0);

        transaction.update(prodRef, {
          stockByLocation,
          stockQuantity: newTotalStock,
          updatedAt: serverTimestamp(),
        });

        restoredProducts.push({
          ...prodData,
          stockByLocation,
          stockQuantity: newTotalStock,
          updatedAt: nowIso,
        });
      }

      // B: If fiado, cancel debt movement
      if (paymentMethod === 'credit' && targetDebtDocRef) {
        transaction.update(targetDebtDocRef, {
          status: 'CANCELLED',
          cancelledAt: serverTimestamp(),
          cancelledAtIso: nowIso,
          cancellationReason: cleanReason,
        });
      }

      // C: If cash movement found, cancel it
      if (existingCashMovRef && cashSnapInTx && cashSnapInTx.exists()) {
        transaction.update(existingCashMovRef, {
          status: 'CANCELLED',
          cancelledAt: serverTimestamp(),
          cancelledAtIso: nowIso,
          cancellationReason: cleanReason,
        });
      }

      // D: Mark sale as CANCELLED
      transaction.update(saleRef, {
        status: 'CANCELLED',
        cancelledAt: serverTimestamp(),
        cancelledAtIso: nowIso,
        cancellationReason: cleanReason,
      });

      returnedSaleRecord = {
        id: saleId,
        createdAt: saleData.createdAtIso || (saleData.createdAt?.toDate ? saleData.createdAt.toDate().toISOString() : nowIso),
        items: saleData.items || [],
        totalAmount: saleData.totalAmount || 0,
        totalItemsCount: saleData.totalItemsCount || 0,
        paymentMethod: saleData.paymentMethod || 'cash',
        customerId: saleData.customerId,
        customerName: saleData.customerName,
        locationId: locKey,
        status: 'CANCELLED',
        cancelledAt: nowIso,
        cancellationReason: cleanReason,
      };
    });

    // Update local caches
    if (returnedSaleRecord) {
      const localSales = getLocalSales();
      const idx = localSales.findIndex(s => s.id === saleId);
      if (idx >= 0) {
        localSales[idx] = returnedSaleRecord;
      } else {
        localSales.unshift(returnedSaleRecord);
      }
      saveLocalSales(localSales);

      // Local account movements update if fiado
      if (returnedSaleRecord.paymentMethod === 'credit') {
        try {
          const rawAcc = localStorage.getItem('despensa_stock_local_account_movements');
          if (rawAcc) {
            const localMovs = JSON.parse(rawAcc);
            const mIdx = localMovs.findIndex((m: any) => m.saleId === saleId && m.type === 'DEBT');
            if (mIdx >= 0) {
              localMovs[mIdx].status = 'CANCELLED';
              localMovs[mIdx].cancelledAt = nowIso;
              localMovs[mIdx].cancellationReason = cleanReason;
              localStorage.setItem('despensa_stock_local_account_movements', JSON.stringify(localMovs));
            }
          }
        } catch {}
      }

      // Local cash movements update
      try {
        const rawCash = localStorage.getItem('despensa_stock_local_cash_movements');
        if (rawCash) {
          const localCash = JSON.parse(rawCash);
          const cIdx = localCash.findIndex((c: any) => c.sourceType === 'SALE' && c.sourceId === saleId);
          if (cIdx >= 0) {
            localCash[cIdx].status = 'CANCELLED';
            localCash[cIdx].cancelledAt = nowIso;
            localCash[cIdx].cancellationReason = cleanReason;
            localStorage.setItem('despensa_stock_local_cash_movements', JSON.stringify(localCash));
          }
        }
      } catch {}

      // Local products update
      for (const p of restoredProducts) {
        productService.updateLocalProduct(p);
      }
    }

    return returnedSaleRecord!;
  },

  /**
   * Alias for getRecentSales
   */
  async getSales(locationId?: LocationSelection): Promise<SaleRecord[]> {
    return this.getRecentSales(locationId);
  },
};

