export type CashMovementType = 'INCOME' | 'EXPENSE';

export type CashPaymentMethod = 'cash' | 'mercado_pago' | 'transfer' | 'credit' | 'other';

export type CashSourceType = 'SALE' | 'CUSTOMER_PAYMENT' | 'EXPENSE' | 'MANUAL' | 'SUPPLIER_PAYMENT' | 'INTERNAL_TRANSFER';

export type CashRegisterType = 'caja_diaria' | 'caja_general' | 'digital';

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
  // Traceability & fund origin / destination fields
  cashRegisterType?: 'caja_diaria' | 'caja_general';
  originFund?: string; // 'caja_diaria' | 'caja_general' | 'mercado_pago' | 'transfer'
  destinationFund?: string; // 'caja_general' | 'caja_diaria'
  paidFrom?: string;
  providerId?: string;
  providerName?: string;
  purchaseId?: string;
  expenseId?: string;
  saleId?: string;
  customerId?: string;
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
  // Accumulated historical balances
  cashBalance: number;
  mercadoPagoBalance: number;
  transferBalance: number;
  otherBalance: number;
  totalBalance: number;

  // Day financial flow
  todayIncome: number;
  todayExpense: number;
  todayNet: number;
  todaySales: number; // Total commercial activity today (cash, MP, transfer, credit/fiado)
  todayCash: number;
  todayMercadoPago: number;
  todayTransfer: number;
  todayOther?: number;

  // CAJA DIARIA (Strictly physical cash in drawer today, starts at $0 each day)
  dailyExpectedCash: number;
  dailyCashIncome: number;
  dailyCashExpense: number;
  dailyTransfersToGeneral: number;
  lastClosure?: CashClosure | null;

  // CAJA GENERAL (Accumulative general business reserve)
  cajaGeneralBalance: number;
  cajaGeneralTotalIn?: number;
  cajaGeneralTotalOut?: number;
}
