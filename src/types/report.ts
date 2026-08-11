export type ReportPeriodOption = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom';

export interface ReportFilter {
  period: ReportPeriodOption;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
}

export interface ComparisonMetric {
  current: number;
  previous: number;
  percentChange: number | null; // null if no comparable previous data
}

export interface PaymentMethodStat {
  method: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface DailySalesStat {
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g. "11 Ago"
  revenue: number;
  count: number;
}

export interface SalesReportSummary {
  totalRevenue: number;
  revenueComparison: ComparisonMetric;
  collectedAmount: number;
  creditSalesAmount: number;
  totalSalesCount: number;
  salesCountComparison: ComparisonMetric;
  averageTicket: number;
  paymentMethodsBreakdown: PaymentMethodStat[];
  dailySalesSeries: DailySalesStat[];
}

export interface TopProductSales {
  productId: string;
  name: string;
  brand?: string;
  presentation?: string;
  quantitySold: number;
  totalRevenue: number;
}

export interface ProductMarginReport {
  productId: string;
  name: string;
  brand?: string;
  presentation?: string;
  salePrice: number;
  costPrice?: number;
  marginAmount?: number;
  marginPercent?: number;
  hasCost: boolean;
}

export interface SupplierStat {
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  totalItemsCount: number;
  orderCount: number;
}

export interface PurchaseReportSummary {
  totalPurchasesAmount: number;
  purchasesComparison: ComparisonMetric;
  totalOrdersCount: number;
  topSupplierName?: string;
  supplierBreakdown: SupplierStat[];
}

export interface ExpenseCategoryStat {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface ExpenseReportSummary {
  totalExpensesAmount: number;
  expensesComparison: ComparisonMetric;
  expenseCount: number;
  averageExpense: number;
  categoryBreakdown: ExpenseCategoryStat[];
}

export interface TopDebtor {
  customerId: string;
  customerName: string;
  phone?: string;
  currentDebt: number;
}

export interface CustomerDebtReportSummary {
  totalDebtBalance: number;
  debtorsCount: number;
  periodPaymentsReceived: number;
  periodCreditSales: number;
  topDebtors: TopDebtor[];
}

export interface CashReportSummary {
  cashBalance: number;
  mercadoPagoBalance: number;
  transferBalance: number;
  otherBalance: number;
  totalBalance: number;
  periodIncome: number;
  periodExpense: number;
}

export interface InventoryReportSummary {
  totalProducts: number;
  totalUnits: number;
  outOfStockCount: number;
  lowStockCount: number;
}

export interface ReportAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  actionTab?: string;
}

export interface EstimatedResultSummary {
  revenue: number;
  estimatedCogs: number;
  operatingExpenses: number;
  estimatedResult: number;
  hasIncompleteCostData: boolean;
}

export interface FullBusinessReport {
  filter: ReportFilter;
  dateRangeLabel: string;
  sales: SalesReportSummary;
  estimatedResult: EstimatedResultSummary;
  topProductsByQty: TopProductSales[];
  topProductsByMargin: ProductMarginReport[];
  purchases: PurchaseReportSummary;
  expenses: ExpenseReportSummary;
  customerDebt: CustomerDebtReportSummary;
  cash: CashReportSummary;
  inventory: InventoryReportSummary;
  alerts: ReportAlert[];
}
