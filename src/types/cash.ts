export type CashMovementType = 'INCOME' | 'EXPENSE';

export type CashPaymentMethod = 'cash' | 'mercado_pago' | 'transfer' | 'other';

export type CashSourceType = 'SALE' | 'CUSTOMER_PAYMENT' | 'EXPENSE' | 'MANUAL';

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  paymentMethod: CashPaymentMethod;
  description: string;
  date: string; // YYYY-MM-DD
  sourceType: CashSourceType;
  sourceId: string;
  locationId?: string;
  notes?: string;
  createdAt: string; // ISO string
  status?: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
}

export type CreateCashMovementInput = Omit<CashMovement, 'id' | 'createdAt'>;

export interface CashClosure {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  expectedCash: number;
  countedCash: number;
  difference: number; // countedCash - expectedCash
  locationId?: string;
  notes?: string;
  createdAt: string; // ISO string
  status?: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface CashBalanceSummary {
  cashBalance: number;
  mercadoPagoBalance: number;
  transferBalance: number;
  otherBalance: number;
  totalBalance: number;
  todayIncome: number;
  todayExpense: number;
  todayNet: number;
}
