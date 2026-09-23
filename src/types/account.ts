export type AccountMovementType = 'DEBT' | 'PAYMENT';

export interface AccountMovement {
  id: string;
  customerId: string;
  type: AccountMovementType;
  amount: number;
  createdAt: string; // ISO timestamp
  description: string;
  saleId?: string;
  locationId?: string;
  notes?: string;
  paymentMethod?: string;
  status?: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface CustomerAccountSummary {
  customerId: string;
  totalDebt: number;
  totalPaid: number;
  balance: number; // totalDebt - totalPaid
  lastMovementDate?: string;
}
