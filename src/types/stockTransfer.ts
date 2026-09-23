export interface StockTransfer {
  id: string;
  date?: string; // Operating business date YYYY-MM-DD in Argentina
  productId: string;
  barcode: string;
  productName: string;
  quantity: number;
  sourceLocationId: string;
  sourceLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  createdAt: string; // ISO String
  notes?: string;
}

export interface CreateStockTransferInput {
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  notes?: string;
}

export type StockTransferRecord = StockTransfer;
