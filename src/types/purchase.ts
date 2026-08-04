import { Product } from './product';

export interface PurchaseItem {
  id?: string;
  productId: string;
  barcode: string;
  name: string;
  brand?: string;
  presentation?: string;
  category?: string;
  providerId: string;
  providerName: string;
  purchaseId?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  previousCost?: number;
  newCost: number;
  previousSalePrice?: number;
  suggestedSalePrice: number;
  finalSalePrice: number;
  purchaseDate: string; // ISO string
}

export interface Purchase {
  id: string;
  providerId: string;
  providerName: string;
  createdAt: string; // ISO string
  totalAmount: number;
  totalItemsCount: number;
  items: PurchaseItem[];
}

export interface ProcessPurchaseItemInput {
  product: Product;
  quantity: number;
  unitCost: number;
  suggestedSalePrice: number;
  finalSalePrice: number;
  previousCost?: number;
  previousSalePrice?: number;
}

export interface ProcessPurchaseInput {
  providerId: string;
  providerName: string;
  items: ProcessPurchaseItemInput[];
}
