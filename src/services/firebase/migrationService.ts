import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db } from './config';

export interface MigrationProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  processedCount: number;
}

export const migrationService = {
  /**
   * Migrate legacy data to multi-location model by assigning locationId: 'aimogasta'
   * to existing sales, purchases, expenses, cash movements, and customer movements
   */
  async migrateLegacyDataToAimogasta(onProgress?: (progress: MigrationProgress) => void): Promise<{ success: boolean; totalUpdated: number }> {
    let totalUpdated = 0;

    const collectionsToMigrate = [
      { name: 'sales', defaultLocationKey: 'locationId' },
      { name: 'purchases', defaultLocationKey: 'locationId' },
      { name: 'expenses', defaultLocationKey: 'locationId' },
      { name: 'cash_movements', defaultLocationKey: 'locationId' },
      { name: 'customer_movements', defaultLocationKey: 'locationId' },
    ];

    try {
      if (onProgress) {
        onProgress({ status: 'running', message: 'Iniciando migración de datos a multiubicación...', processedCount: 0 });
      }

      for (const colInfo of collectionsToMigrate) {
        if (onProgress) {
          onProgress({ status: 'running', message: `Verificando colección "${colInfo.name}"...`, processedCount: totalUpdated });
        }

        const colRef = collection(db, colInfo.name);
        const snapshot = await getDocs(colRef);

        let batch = writeBatch(db);
        let batchCount = 0;

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          if (!data.locationId) {
            batch.update(doc(db, colInfo.name, docSnap.id), {
              locationId: 'aimogasta',
            });
            batchCount++;
            totalUpdated++;

            if (batchCount >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      // Also ensure products have stockByLocation properly initialized
      if (onProgress) {
        onProgress({ status: 'running', message: 'Verificando catálogo de productos...', processedCount: totalUpdated });
      }

      const productsRef = collection(db, 'products');
      const productsSnap = await getDocs(productsRef);
      let prodBatch = writeBatch(db);
      let prodBatchCount = 0;

      for (const prodSnap of productsSnap.docs) {
        const pData = prodSnap.data();
        if (!pData.stockByLocation || typeof pData.stockByLocation !== 'object') {
          const legacyStock = pData.stockQuantity ?? pData.stock ?? 0;
          prodBatch.update(doc(db, 'products', prodSnap.id), {
            stockByLocation: {
              aimogasta: legacyStock,
              olascoaga: 0,
            },
            stockQuantity: legacyStock,
            stock: legacyStock,
          });
          prodBatchCount++;
          totalUpdated++;

          if (prodBatchCount >= 400) {
            await prodBatch.commit();
            prodBatch = writeBatch(db);
            prodBatchCount = 0;
          }
        }
      }

      if (prodBatchCount > 0) {
        await prodBatch.commit();
      }

      if (onProgress) {
        onProgress({
          status: 'completed',
          message: `Migración completada con éxito. Registros actualizados: ${totalUpdated}`,
          processedCount: totalUpdated,
        });
      }

      return { success: true, totalUpdated };
    } catch (error) {
      console.error('Error durante la migración de datos:', error);
      if (onProgress) {
        onProgress({
          status: 'error',
          message: `Error en la migración: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          processedCount: totalUpdated,
        });
      }
      return { success: false, totalUpdated };
    }
  },
};
