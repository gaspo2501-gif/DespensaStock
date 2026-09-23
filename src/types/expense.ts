export type ExpenseCategory = 
  | 'Alquiler'
  | 'Electricidad'
  | 'Agua'
  | 'Internet'
  | 'Teléfono'
  | 'Impuestos'
  | 'Transporte'
  | 'Mantenimiento'
  | 'Comisiones'
  | 'Publicidad'
  | 'Limpieza'
  | 'Sueldos'
  | 'Otros';

export type ExpensePaymentMethod = 'cash' | 'mercado_pago' | 'transfer' | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string; // ISO date string format YYYY-MM-DD
  paymentMethod: ExpensePaymentMethod;
  locationId?: string;
  notes?: string;
  recurrent: boolean;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  status?: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
}

export type CreateExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Alquiler',
  'Electricidad',
  'Agua',
  'Internet',
  'Teléfono',
  'Impuestos',
  'Transporte',
  'Mantenimiento',
  'Comisiones',
  'Publicidad',
  'Limpieza',
  'Sueldos',
  'Otros'
];

export const EXPENSE_PAYMENT_METHODS: { id: ExpensePaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'mercado_pago', label: 'Mercado Pago' },
  { id: 'transfer', label: 'Transferencia' },
  { id: 'other', label: 'Otro' },
];
