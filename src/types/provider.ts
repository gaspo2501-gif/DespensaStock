export interface Provider {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  totalPurchased?: number;
  totalPaid?: number;
  currentDebt?: number;
}

export type CreateProviderInput = Omit<Provider, 'id' | 'createdAt' | 'updatedAt' | 'totalPurchased' | 'totalPaid' | 'currentDebt'>;

export type SupplierPaymentSource = 'caja_diaria' | 'caja_general' | 'mercado_pago' | 'transfer' | 'other';

export interface SupplierPayment {
  id: string;
  providerId: string;
  providerName: string;
  purchaseId?: string; // Optional: linked to a specific purchase
  amount: number;
  date: string; // YYYY-MM-DD
  paidFrom: SupplierPaymentSource;
  locationId?: string;
  notes?: string;
  createdAt: string; // ISO string
  status?: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
}

export type CreateSupplierPaymentInput = Omit<SupplierPayment, 'id' | 'createdAt'>;
