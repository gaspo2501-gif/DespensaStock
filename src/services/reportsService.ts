import { LocationSelection } from '../types/location';
import { 
  ReportFilter, 
  FullBusinessReport, 
  ComparisonMetric, 
  PaymentMethodStat, 
  DailySalesStat, 
  TopProductSales, 
  ProductMarginReport, 
  SupplierStat, 
  ExpenseCategoryStat, 
  TopDebtor, 
  ReportAlert 
} from '../types/report';
import { salesService } from './firebase/salesService';
import { productService } from './firebase/productService';
import { customerService } from './firebase/customerService';
import { accountService } from './firebase/accountService';
import { expenseService } from './firebase/expenseService';
import { cashService } from './firebase/cashService';
import { purchaseService } from './firebase/purchaseService';
import { providerService } from './firebase/providerService';
import { SaleRecord } from '../types/sale';
import { Product, getStockForLocation } from '../types/product';
import { Expense } from '../types/expense';
import { Purchase } from '../types/purchase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase/config';
import { 
  toArgentinaDateString, 
  getArgentinaToday, 
  getArgentinaYesterday, 
  getArgentinaDaysAgo, 
  getArgentinaFirstOfMonth, 
  formatLocalDate, 
  getArgentinaDayRange, 
  isWithinArgentinaRange 
} from '../utils/dateUtils';

function parseDate(dateInput: any): Date {
  if (!dateInput) return new Date(0);
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'string') {
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (dateInput?.toDate && typeof dateInput.toDate === 'function') {
    return dateInput.toDate();
  }
  return new Date(0);
}

function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current > 0) return 100;
    if (current === 0) return 0;
    return null;
  }
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

export const reportsService = {
  /**
   * Determine date boundaries for current period and comparison previous period
   */
  getPeriodRange(filter: ReportFilter): {
    start: Date;
    end: Date;
    prevStart: Date;
    prevEnd: Date;
    label: string;
  } {
    if (filter.period === 'today') {
      const todayStr = getArgentinaToday();
      const dayRange = getArgentinaDayRange(todayStr);
      const prevRange = getArgentinaDayRange(getArgentinaYesterday());
      return {
        start: dayRange.start,
        end: dayRange.end,
        prevStart: prevRange.start,
        prevEnd: prevRange.end,
        label: `Hoy (${formatLocalDate(todayStr)})`,
      };
    }

    if (filter.period === 'yesterday') {
      const yesterdayStr = getArgentinaYesterday();
      const dayRange = getArgentinaDayRange(yesterdayStr);
      const prevRange = getArgentinaDayRange(getArgentinaDaysAgo(2));
      return {
        start: dayRange.start,
        end: dayRange.end,
        prevStart: prevRange.start,
        prevEnd: prevRange.end,
        label: `Ayer (${formatLocalDate(yesterdayStr)})`,
      };
    }

    if (filter.period === 'last7days') {
      const todayStr = getArgentinaToday();
      const startStr = getArgentinaDaysAgo(6);
      const start = getArgentinaDayRange(startStr).start;
      const end = getArgentinaDayRange(todayStr).end;
      const prevStart = getArgentinaDayRange(getArgentinaDaysAgo(13)).start;
      const prevEnd = getArgentinaDayRange(getArgentinaDaysAgo(7)).end;
      return {
        start,
        end,
        prevStart,
        prevEnd,
        label: `Últimos 7 días (${formatLocalDate(startStr)} - ${formatLocalDate(todayStr)})`,
      };
    }

    if (filter.period === 'thisMonth') {
      const todayStr = getArgentinaToday();
      const firstOfMonthStr = getArgentinaFirstOfMonth();
      const start = getArgentinaDayRange(firstOfMonthStr).start;
      const end = getArgentinaDayRange(todayStr).end;

      const [y, m] = todayStr.split('-').map(Number);
      const prevMonthDate = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0));
      const prevY = prevMonthDate.getUTCFullYear();
      const prevM = String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0');
      const prevFirstOfMonthStr = `${prevY}-${prevM}-01`;
      const prevStart = getArgentinaDayRange(prevFirstOfMonthStr).start;
      const daysPassed = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      const prevEnd = new Date(prevStart.getTime() + daysPassed * 86400000 - 1);

      return {
        start,
        end,
        prevStart,
        prevEnd,
        label: `Este mes (${formatLocalDate(firstOfMonthStr)} - ${formatLocalDate(todayStr)})`,
      };
    }

    if (filter.period === 'lastMonth') {
      const todayStr = getArgentinaToday();
      const [y, m] = todayStr.split('-').map(Number);
      const lastDayPrevMonth = new Date(Date.UTC(y, m - 1, 0, 12, 0, 0));
      const lpY = lastDayPrevMonth.getUTCFullYear();
      const lpM = String(lastDayPrevMonth.getUTCMonth() + 1).padStart(2, '0');
      const lpD = String(lastDayPrevMonth.getUTCDate()).padStart(2, '0');
      const startStr = `${lpY}-${lpM}-01`;
      const endStr = `${lpY}-${lpM}-${lpD}`;
      const start = getArgentinaDayRange(startStr).start;
      const end = getArgentinaDayRange(endStr).end;

      const lastDay2MonthsAgo = new Date(Date.UTC(y, m - 2, 0, 12, 0, 0));
      const p2Y = lastDay2MonthsAgo.getUTCFullYear();
      const p2M = String(lastDay2MonthsAgo.getUTCMonth() + 1).padStart(2, '0');
      const p2D = String(lastDay2MonthsAgo.getUTCDate()).padStart(2, '0');
      const prevStartStr = `${p2Y}-${p2M}-01`;
      const prevEndStr = `${p2Y}-${p2M}-${p2D}`;
      const prevStart = getArgentinaDayRange(prevStartStr).start;
      const prevEnd = getArgentinaDayRange(prevEndStr).end;

      return {
        start,
        end,
        prevStart,
        prevEnd,
        label: `Mes anterior (${formatLocalDate(startStr)} - ${formatLocalDate(endStr)})`,
      };
    }

    if (filter.period === 'custom' && filter.fromDate && filter.toDate) {
      const start = getArgentinaDayRange(filter.fromDate).start;
      const end = getArgentinaDayRange(filter.toDate).end;
      const diffMs = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - diffMs - 1);
      const prevEnd = new Date(start.getTime() - 1);
      return {
        start,
        end,
        prevStart,
        prevEnd,
        label: `Personalizado (${formatLocalDate(filter.fromDate)} - ${formatLocalDate(filter.toDate)})`,
      };
    }

    // Default fallback to thisMonth
    const todayStr = getArgentinaToday();
    const dayRange = getArgentinaDayRange(todayStr);
    return {
      start: dayRange.start,
      end: dayRange.end,
      prevStart: dayRange.start,
      prevEnd: dayRange.end,
      label: `Hoy (${formatLocalDate(todayStr)})`,
    };
  },

  /**
   * Main report consolidation engine. Fetches data once and computes metrics in memory.
   */
  async generateFullReport(filter: ReportFilter, locationId?: LocationSelection): Promise<FullBusinessReport> {
    const range = this.getPeriodRange(filter);

    // Fetch all collections in parallel for optimal response speed
    const [
      rawSales,
      allProducts,
      allCustomers,
      allCustomerMovements,
      customerBalances,
      rawExpenses,
      rawPurchases,
      allProviders,
      cashSummary
    ] = await Promise.all([
      salesService.getRecentSales().catch(() => []),
      productService.getAllProducts().catch(() => []),
      customerService.getAllCustomers().catch(() => []),
      accountService.getAllMovements(locationId).catch(() => []),
      accountService.getAllBalances(locationId).catch(() => ({} as Record<string, number>)),
      expenseService.getExpenses(locationId).catch(() => []),
      this.getPurchases(locationId).catch(() => []),
      providerService.getAllProviders().catch(() => []),
      cashService.getCashSummary(locationId).catch(() => ({
        cashBalance: 0,
        mercadoPagoBalance: 0,
        transferBalance: 0,
        otherBalance: 0,
        totalBalance: 0,
        todayIncome: 0,
        todayExpense: 0,
        todayNet: 0
      }))
    ]);

    // Filter by locationId if specified and exclude cancelled records from metrics
    const allSales = (locationId
      ? rawSales.filter((s: any) => !s.locationId || s.locationId === locationId)
      : rawSales).filter((s: any) => s.status !== 'CANCELLED');

    const allExpenses = (locationId
      ? rawExpenses.filter((e: any) => !e.locationId || e.locationId === locationId)
      : rawExpenses).filter((e: any) => e.status !== 'CANCELLED');

    const allPurchases = (locationId
      ? rawPurchases.filter((p: any) => !p.locationId || p.locationId === locationId)
      : rawPurchases).filter((p: any) => p.status !== 'CANCELLED');

    // Product lookup map
    const productMap = new Map<string, Product>();
    allProducts.forEach(p => productMap.set(p.id, p));

    // Filter sales by current range vs previous range
    const currentSales = allSales.filter(s => {
      return isWithinArgentinaRange(s.date || s.createdAt, range.start, range.end);
    });

    const prevSales = allSales.filter(s => {
      return isWithinArgentinaRange(s.date || s.createdAt, range.prevStart, range.prevEnd);
    });

    // 1. Sales KPI Metrics
    const totalRevenue = currentSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const prevRevenue = prevSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);

    const totalSalesCount = currentSales.length;
    const prevSalesCount = prevSales.length;

    const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

    let collectedAmount = 0;
    let creditSalesAmount = 0;

    const paymentMethodsMap: Record<string, { amount: number; count: number }> = {
      cash: { amount: 0, count: 0 },
      mercado_pago: { amount: 0, count: 0 },
      credit: { amount: 0, count: 0 },
      transfer: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    };

    for (const s of currentSales) {
      const method = s.paymentMethod || 'cash';
      if (!paymentMethodsMap[method]) {
        paymentMethodsMap[method] = { amount: 0, count: 0 };
      }
      paymentMethodsMap[method].amount += s.totalAmount || 0;
      paymentMethodsMap[method].count += 1;

      if (method === 'credit') {
        creditSalesAmount += s.totalAmount || 0;
      } else {
        collectedAmount += s.totalAmount || 0;
      }
    }

    const methodLabels: Record<string, string> = {
      cash: 'Efectivo',
      mercado_pago: 'Mercado Pago',
      credit: 'Fiado (Crédito)',
      transfer: 'Transferencia',
      other: 'Otros'
    };

    const paymentMethodsBreakdown: PaymentMethodStat[] = Object.keys(paymentMethodsMap).map(mKey => {
      const item = paymentMethodsMap[mKey];
      return {
        method: mKey,
        label: methodLabels[mKey] || mKey,
        amount: item.amount,
        count: item.count,
        percentage: totalRevenue > 0 ? Math.round((item.amount / totalRevenue) * 1000) / 10 : 0
      };
    }).sort((a, b) => b.amount - a.amount);

    // 2. Daily Sales Series for Chart
    const dailyMap = new Map<string, { revenue: number; count: number }>();
    currentSales.forEach(s => {
      const key = s.date || toArgentinaDateString(s.createdAt);
      if (!key) return;
      const cur = dailyMap.get(key) || { revenue: 0, count: 0 };
      dailyMap.set(key, {
        revenue: cur.revenue + (s.totalAmount || 0),
        count: cur.count + 1
      });
    });

    const dailySalesSeries: DailySalesStat[] = Array.from(dailyMap.entries())
      .map(([dateStr, val]) => {
        const parts = dateStr.split('-');
        const displayDate = `${parts[2]}/${parts[1]}`;
        return {
          date: dateStr,
          displayDate,
          revenue: val.revenue,
          count: val.count
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // 3. Top Sold Products & Estimated COGS
    const productStatsMap = new Map<string, { qty: number; revenue: number; name: string; brand?: string; presentation?: string }>();
    let totalEstimatedCogs = 0;
    let hasIncompleteCostData = false;

    currentSales.forEach(s => {
      s.items.forEach(item => {
        const pId = item.productId || item.name;
        const cur = productStatsMap.get(pId) || {
          qty: 0,
          revenue: 0,
          name: item.name,
          brand: item.brand,
          presentation: item.presentation
        };
        cur.qty += item.quantity || 0;
        cur.revenue += item.subtotal || 0;
        productStatsMap.set(pId, cur);

        // Estimate Cost
        const p = productMap.get(item.productId);
        const cost = p?.costPrice ?? p?.currentCost ?? p?.lastCost;
        if (cost !== undefined && cost > 0) {
          totalEstimatedCogs += cost * (item.quantity || 0);
        } else {
          hasIncompleteCostData = true;
        }
      });
    });

    const topProductsByQty: TopProductSales[] = Array.from(productStatsMap.entries())
      .map(([pId, val]) => ({
        productId: pId,
        name: val.name,
        brand: val.brand,
        presentation: val.presentation,
        quantitySold: val.qty,
        totalRevenue: val.revenue
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    // 4. Product Margins Report
    const topProductsByMargin: ProductMarginReport[] = allProducts.map(p => {
      const sale = p.salePrice || 0;
      const cost = p.costPrice ?? p.currentCost ?? p.lastCost;
      const hasCost = cost !== undefined && cost > 0;

      let marginAmount: number | undefined;
      let marginPercent: number | undefined;

      if (hasCost && sale > 0) {
        marginAmount = sale - cost;
        marginPercent = Math.round(((sale - cost) / cost) * 1000) / 10;
      }

      return {
        productId: p.id,
        name: p.name,
        brand: p.brand,
        presentation: p.presentation,
        salePrice: sale,
        costPrice: cost,
        marginAmount,
        marginPercent,
        hasCost
      };
    })
    .filter(p => p.hasCost && (p.marginPercent ?? 0) > 0)
    .sort((a, b) => (b.marginPercent || 0) - (a.marginPercent || 0))
    .slice(0, 10);

    // 5. Operating Expenses Metrics
    const currentExpenses = allExpenses.filter(e => {
      return isWithinArgentinaRange(e.date || e.createdAt, range.start, range.end);
    });

    const prevExpenses = allExpenses.filter(e => {
      return isWithinArgentinaRange(e.date || e.createdAt, range.prevStart, range.prevEnd);
    });

    const totalExpensesAmount = currentExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const prevExpensesAmount = prevExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const expenseCount = currentExpenses.length;
    const averageExpense = expenseCount > 0 ? totalExpensesAmount / expenseCount : 0;

    const expenseCategoryMap = new Map<string, { amount: number; count: number }>();
    currentExpenses.forEach(e => {
      const cat = e.category || 'Otros';
      const cur = expenseCategoryMap.get(cat) || { amount: 0, count: 0 };
      cur.amount += e.amount || 0;
      cur.count += 1;
      expenseCategoryMap.set(cat, cur);
    });

    const expenseCategories: ExpenseCategoryStat[] = Array.from(expenseCategoryMap.entries())
      .map(([cat, val]) => ({
        category: cat,
        amount: val.amount,
        count: val.count,
        percentage: totalExpensesAmount > 0 ? Math.round((val.amount / totalExpensesAmount) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // 6. Purchases & Suppliers Metrics
    const currentPurchases = allPurchases.filter(p => {
      return isWithinArgentinaRange(p.date || p.purchaseDate || p.createdAt, range.start, range.end);
    });

    const prevPurchases = allPurchases.filter(p => {
      return isWithinArgentinaRange(p.date || p.purchaseDate || p.createdAt, range.prevStart, range.prevEnd);
    });

    const totalPurchasesAmount = currentPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const prevPurchasesAmount = prevPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const totalOrdersCount = currentPurchases.length;

    const supplierMap = new Map<string, { name: string; amount: number; itemsCount: number; orderCount: number }>();
    currentPurchases.forEach(p => {
      const supId = p.providerId || p.providerName || 'Desconocido';
      const supName = p.providerName || 'Proveedor';
      const cur = supplierMap.get(supId) || { name: supName, amount: 0, itemsCount: 0, orderCount: 0 };
      cur.amount += p.totalAmount || 0;
      cur.itemsCount += p.totalItemsCount || 0;
      cur.orderCount += 1;
      supplierMap.set(supId, cur);
    });

    const supplierBreakdown: SupplierStat[] = Array.from(supplierMap.entries())
      .map(([sId, val]) => ({
        supplierId: sId,
        supplierName: val.name,
        totalAmount: val.amount,
        totalItemsCount: val.itemsCount,
        orderCount: val.orderCount
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const topSupplierName = supplierBreakdown.length > 0 ? supplierBreakdown[0].supplierName : undefined;

    // 7. Customer Debt Summary
    let totalDebtBalance = 0;
    let debtorsCount = 0;
    const topDebtorsList: TopDebtor[] = [];

    const customerMap = new Map<string, string>();
    allCustomers.forEach(c => customerMap.set(c.id, c.name));

    Object.entries(customerBalances as Record<string, number>).forEach(([cid, bal]) => {
      const balanceNum = Number(bal) || 0;
      if (balanceNum > 0) {
        totalDebtBalance += balanceNum;
        debtorsCount += 1;
        const cObj = allCustomers.find(c => c.id === cid);
        topDebtorsList.push({
          customerId: cid,
          customerName: cObj ? cObj.name : 'Cliente',
          phone: cObj?.phone,
          currentDebt: balanceNum
        });
      }
    });

    topDebtorsList.sort((a, b) => b.currentDebt - a.currentDebt);

    // Payments & Credit sales in period
    let periodPaymentsReceived = 0;
    let periodCreditSales = 0;

    allCustomerMovements.forEach(m => {
      const d = parseDate(m.createdAt);
      if (d >= range.start && d <= range.end) {
        if (m.type === 'PAYMENT') {
          periodPaymentsReceived += m.amount || 0;
        } else if (m.type === 'DEBT') {
          periodCreditSales += m.amount || 0;
        }
      }
    });

    // 8. Cash Report Metrics
    const periodCashIncome = collectedAmount + periodPaymentsReceived;
    const periodCashExpense = totalExpensesAmount;

    // 9. Inventory Report Metrics
    const totalProducts = allProducts.length;
    let totalUnits = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;

    allProducts.forEach(p => {
      const qty = locationId ? getStockForLocation(p, locationId) : (p.stockQuantity || 0);
      totalUnits += qty;
      if (qty <= 0) {
        outOfStockCount += 1;
      } else if (qty <= (p.minStockAlert || 5)) {
        lowStockCount += 1;
      }
    });

    // 10. Estimated Result
    const estimatedResult = totalRevenue - totalEstimatedCogs - totalExpensesAmount;

    // 11. Smart Alerts Generation
    const alerts: ReportAlert[] = [];

    if (outOfStockCount > 0) {
      alerts.push({
        id: 'alert_stock',
        type: 'danger',
        title: 'Productos sin stock',
        message: `Tenés ${outOfStockCount} producto(s) totalmente agotados en catálogo.`,
        actionTab: 'stock'
      });
    }

    if (debtorsCount > 0) {
      alerts.push({
        id: 'alert_debt',
        type: 'warning',
        title: 'Cuentas corrientes con saldo pendiente',
        message: `${debtorsCount} cliente(s) adeudan un total de $${totalDebtBalance.toLocaleString('es-AR')}.`,
        actionTab: 'customers'
      });
    }

    if (prevExpensesAmount > 0 && totalExpensesAmount > prevExpensesAmount * 1.3) {
      alerts.push({
        id: 'alert_expenses_up',
        type: 'warning',
        title: 'Gastos en aumento',
        message: `Los gastos aumentaron un ${calcPercentChange(totalExpensesAmount, prevExpensesAmount)}% en comparación con el período anterior.`,
        actionTab: 'expenses'
      });
    }

    return {
      filter,
      dateRangeLabel: range.label,
      sales: {
        totalRevenue,
        revenueComparison: {
          current: totalRevenue,
          previous: prevRevenue,
          percentChange: calcPercentChange(totalRevenue, prevRevenue)
        },
        collectedAmount,
        creditSalesAmount,
        totalSalesCount,
        salesCountComparison: {
          current: totalSalesCount,
          previous: prevSalesCount,
          percentChange: calcPercentChange(totalSalesCount, prevSalesCount)
        },
        averageTicket,
        paymentMethodsBreakdown,
        dailySalesSeries
      },
      estimatedResult: {
        revenue: totalRevenue,
        estimatedCogs: totalEstimatedCogs,
        operatingExpenses: totalExpensesAmount,
        estimatedResult,
        hasIncompleteCostData
      },
      topProductsByQty,
      topProductsByMargin,
      purchases: {
        totalPurchasesAmount,
        purchasesComparison: {
          current: totalPurchasesAmount,
          previous: prevPurchasesAmount,
          percentChange: calcPercentChange(totalPurchasesAmount, prevPurchasesAmount)
        },
        totalOrdersCount,
        topSupplierName,
        supplierBreakdown
      },
      expenses: {
        totalExpensesAmount,
        expensesComparison: {
          current: totalExpensesAmount,
          previous: prevExpensesAmount,
          percentChange: calcPercentChange(totalExpensesAmount, prevExpensesAmount)
        },
        expenseCount,
        averageExpense,
        categoryBreakdown: expenseCategories
      },
      customerDebt: {
        totalDebtBalance,
        debtorsCount,
        periodPaymentsReceived,
        periodCreditSales,
        topDebtors: topDebtorsList.slice(0, 5)
      },
      cash: {
        cashBalance: cashSummary.cashBalance,
        mercadoPagoBalance: cashSummary.mercadoPagoBalance,
        transferBalance: cashSummary.transferBalance,
        otherBalance: cashSummary.otherBalance,
        totalBalance: cashSummary.totalBalance,
        periodIncome: periodCashIncome,
        periodExpense: periodCashExpense
      },
      inventory: {
        totalProducts,
        totalUnits,
        outOfStockCount,
        lowStockCount
      },
      alerts
    };
  },

  /**
   * Helper to query raw purchases
   */
  async getPurchases(locationId?: LocationSelection): Promise<Purchase[]> {
    try {
      const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const purchases: Purchase[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const pLocation = data.locationId || 'aimogasta';
        if (locationId && locationId !== 'all' && pLocation !== locationId) {
          return;
        }
        purchases.push({
          id: docSnap.id,
          providerId: data.providerId || '',
          providerName: data.providerName || 'Proveedor',
          locationId: pLocation,
          createdAt: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          totalAmount: data.totalAmount || 0,
          totalItemsCount: data.totalItemsCount || 0,
          items: data.items || [],
          status: data.status,
          cancellationReason: data.cancelReason || data.cancellationReason,
          cancelledAt: data.cancelledAt
        });
      });
      return purchases;
    } catch {
      return [];
    }
  }
};
