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

export type PaymentMethod = 'cash' | 'mercado_pago' | 'transfer' | 'credit' | 'mixed';

export interface PaymentBreakdown {
  cash?: number;
  mercado_pago?: number;
  transfer?: number;
  credit?: number;
}

export interface SaleRecord {
  id: string;
  date?: string; // Operating business date YYYY-MM-DD in Argentina
  createdAt: string; // ISO timestamp
  items: SaleItemRecord[];
  totalAmount: number;
  totalItemsCount: number;
  paymentMethod?: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  customerId?: string;
  customerName?: string;
  locationId?: string;
  status?: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
}
