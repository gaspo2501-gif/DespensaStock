import { Product } from './product';

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number; // Applied unit price for this sale
  subtotal: number;
}

export interface SaleItemRecord {
  productId: string;
  barcode: string;
  name: string;
  brand?: string;
  presentation?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'mercado_pago' | 'credit';

export interface SaleRecord {
  id: string;
  createdAt: string; // ISO timestamp
  items: SaleItemRecord[];
  totalAmount: number;
  totalItemsCount: number;
  paymentMethod?: PaymentMethod;
  customerId?: string;
  customerName?: string;
}
