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
  locationId?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  previousCost?: number;
  newCost: number;
  previousSalePrice?: number;
  suggestedSalePrice: number;
  finalSalePrice: number;
  purchaseDate: string; // ISO string
  status?: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface Purchase {
  id: string;
  date?: string; // Operating business date YYYY-MM-DD in Argentina
  providerId: string;
  providerName: string;
  locationId?: string;
  createdAt: string; // ISO string
  totalAmount: number;
  totalItemsCount: number;
  items: PurchaseItem[];
  status?: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
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
  locationId?: string;
  items: ProcessPurchaseItemInput[];
}
