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
export type ExpensePaidFrom = 'caja_diaria' | 'caja_general' | 'mercado_pago' | 'transfer' | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string; // ISO date string format YYYY-MM-DD
  paymentMethod: ExpensePaymentMethod;
  paidFrom?: ExpensePaidFrom; // Origin of funds (Caja Diaria vs Caja General vs MP vs Transfer)
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

export const EXPENSE_PAID_FROM_OPTIONS: { id: ExpensePaidFrom; label: string; desc: string }[] = [
  { id: 'caja_diaria', label: 'Caja Diaria (Local)', desc: 'Descuenta del efectivo físico en el cajón de hoy' },
  { id: 'caja_general', label: 'Caja General (Fondo negocio)', desc: 'Fondo acumulado. No afecta el cajón de hoy' },
  { id: 'mercado_pago', label: 'Mercado Pago', desc: 'Dinero digital MP' },
  { id: 'transfer', label: 'Transferencia Bancaria', desc: 'Cuenta de banco / transferencias' },
  { id: 'other', label: 'Otro medio', desc: 'Otros fondos' },
];
