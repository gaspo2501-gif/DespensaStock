import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ReportPeriodOption, 
  ReportFilter, 
  FullBusinessReport 
} from '../types/report';
import { Product, NavigationTab } from '../types/product';
import { reportsService } from '../services/reportsService';
import { purchaseService } from '../services/firebase/purchaseService';
import { PurchaseItem } from '../types/purchase';
import { useLocation } from '../context/LocationContext';
import { getLocationName } from '../types/location';
import { LocationSelector } from '../components/common/LocationSelector';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Wallet, 
  Users, 
  Boxes, 
  Receipt, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  Store, 
  CreditCard, 
  Tag, 
  PieChart, 
  HelpCircle,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Building2
} from 'lucide-react';

interface ReportsPageProps {
  products: Product[];
  onNavigate: (tab: NavigationTab) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ products, onNavigate }) => {
  const { reportLocationFilter, getLocationName } = useLocation();

  // Filter state
  const [period, setPeriod] = useState<ReportPeriodOption>('thisMonth');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Main Report State
  const [report, setReport] = useState<FullBusinessReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Supplier Cost Comparison State
  const [selectedProductId, setSelectedProductId] = useState<string>(() => products[0]?.id || '');
  const [costHistory, setCostHistory] = useState<{
    items: PurchaseItem[];
    lastPurchase: PurchaseItem | null;
    bestCost: PurchaseItem | null;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Load report data
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: ReportFilter = { period, fromDate, toDate };
      const data = await reportsService.generateFullReport(filter, reportLocationFilter);
      setReport(data);
    } catch (err) {
      console.error('Error al generar reporte:', err);
      setError('Ocurrió un problema al calcular los reportes. Por favor, reintentá.');
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate, reportLocationFilter]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Load product cost history when product changes
  useEffect(() => {
    if (!selectedProductId) return;
    let isMounted = true;
    setLoadingHistory(true);
    purchaseService.getCostHistoryForProduct(selectedProductId)
      .then((res) => {
        if (isMounted) {
          setCostHistory(res);
          setLoadingHistory(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCostHistory(null);
          setLoadingHistory(false);
        }
      });
    return () => { isMounted = false; };
  }, [selectedProductId]);

  const selectedProductObj = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Render comparison badge
  const renderComparisonPill = (metric?: { current: number; previous: number; percentChange: number | null }) => {
    if (!metric || metric.percentChange === null) {
      return <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Sin datos previos</span>;
    }
    const val = metric.percentChange;
    if (val > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <ArrowUpRight className="w-3 h-3" />
          +{val}%
        </span>
      );
    }
    if (val < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
          <ArrowDownRight className="w-3 h-3" />
          {val}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
        <Minus className="w-3 h-3" />
        0%
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 sm:px-6">
      {/* HEADER */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight">📊 Reportes</h1>
                <span className="text-[11px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {getLocationName(reportLocationFilter)}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Resumen comercial por sucursal o consolidado general</p>
            </div>
          </div>
        </div>

        <button
          onClick={loadReport}
          disabled={loading}
          className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Datos</span>
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Sucursal a analizar:</span>
          </div>
          <LocationSelector allowAll={true} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Período de Análisis</span>
          </div>
          {report && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              {report.dateRangeLabel}
            </span>
          )}
        </div>

        {/* Quick Period Buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'yesterday', label: 'Ayer' },
            { id: 'last7days', label: 'Últimos 7 días' },
            { id: 'thisMonth', label: 'Este mes' },
            { id: 'lastMonth', label: 'Mes anterior' },
            { id: 'custom', label: 'Personalizado' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setPeriod(btn.id as ReportPeriodOption)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                period === btn.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker */}
        {period === 'custom' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Desde:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Hasta:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-16 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Calculando indicadores e informes...</p>
        </div>
      ) : error || !report ? (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-rose-800 space-y-2 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="font-bold text-sm">{error || 'No se pudieron cargar los datos.'}</p>
        </div>
      ) : (
        <>
          {/* SMART ALERTS BANNER */}
          {report.alerts.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Atención y Advertencias</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.alerts.map((al) => (
                  <div
                    key={al.id}
                    className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                      al.type === 'danger'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : al.type === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    <div>
                      <h4 className="font-extrabold text-xs">{al.title}</h4>
                      <p className="text-xs mt-0.5 opacity-90">{al.message}</p>
                    </div>
                    {al.actionTab && (
                      <button
                        onClick={() => onNavigate(al.actionTab as NavigationTab)}
                        className="px-3 py-1 bg-white/80 hover:bg-white text-xs font-extrabold rounded-xl shadow-2xs border border-current shrink-0"
                      >
                        Ver
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAIN KPI GRID (RESUMEN GENERAL) */}
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Resumen General Comercial
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. FACTURACIÓN */}
              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">💰 Facturación</span>
                  {renderComparisonPill(report.sales.revenueComparison)}
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">
                    ${report.sales.totalRevenue.toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">Ventas totales en el período</p>
                </div>
              </div>

              {/* 2. COBRADO */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-emerald-800 tracking-wider">💵 Cobrado</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Efectivo/MP/Transf</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-900">
                    ${report.sales.collectedAmount.toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium">Ingreso efectivamente cobrado</p>
                </div>
              </div>

              {/* 3. VENTAS FIADAS */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-amber-800 tracking-wider">📋 Ventas Fiadas</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">En el período</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-amber-900">
                    ${report.sales.creditSalesAmount.toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-amber-700 font-medium">A crédito (no ingresó caja aún)</p>
                </div>
              </div>

              {/* 4. CUENTAS POR COBRAR (DEUDA ACTUAL GLOBAL) */}
              <div className="p-4 bg-purple-50/70 border border-purple-200/90 rounded-2xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-purple-800 tracking-wider">💳 Cuentas por Cobrar</span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Estado Actual</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-purple-900">
                    ${report.customerDebt.totalDebtBalance.toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-purple-700 font-medium">Adeudado por {report.customerDebt.debtorsCount} clientes</p>
                </div>
              </div>

              {/* 5. COMPRAS MERCADERÍA */}
              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">🛒 Compras Mercadería</span>
                  {renderComparisonPill(report.purchases.purchasesComparison)}
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">
                    ${report.purchases.totalPurchasesAmount.toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">{report.purchases.totalOrdersCount} órdenes de compra</p>
                </div>
              </div>

              {/* 6. GASTOS OPERATIVOS */}
              <div className="p-4 bg-rose-50/60 border border-rose-200/90 rounded-2xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-rose-800 tracking-wider">📉 Gastos Operativos</span>
                  {renderComparisonPill(report.expenses.expensesComparison)}
                </div>
                <div>
                  <p className="text-2xl font-black text-rose-900">
                    ${report.expenses.totalExpensesAmount.toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-rose-700 font-medium">{report.expenses.expenseCount} gastos registrados</p>
                </div>
              </div>

              {/* 7. RESULTADO ESTIMADO */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">💰 Resultado Estimado</span>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">Estimación Comercial</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className={`text-3xl font-black ${report.estimatedResult.estimatedResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${report.estimatedResult.estimatedResult.toLocaleString('es-AR')}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Facturación (${report.sales.totalRevenue.toLocaleString('es-AR')}) - Costo est. (${report.estimatedResult.estimatedCogs.toLocaleString('es-AR')}) - Gastos (${report.expenses.totalExpensesAmount.toLocaleString('es-AR')})
                    </p>
                  </div>
                </div>
                {report.estimatedResult.hasIncompleteCostData && (
                  <p className="text-[10px] text-amber-300 font-medium flex items-center gap-1 pt-1 border-t border-slate-800">
                    <HelpCircle className="w-3 h-3" />
                    <span>Algunos productos no tienen costo registrado; el costo estimado puede ser parcial.</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION: VENTAS POR FORMA DE PAGO */}
          <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Ventas por Forma de Pago</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {report.sales.paymentMethodsBreakdown.map((pm) => (
                <div key={pm.method} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                    <span>{pm.label}</span>
                    <span className="text-emerald-700">{pm.percentage}%</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">${pm.amount.toLocaleString('es-AR')}</p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, pm.percentage)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-semibold">{pm.count} operacione(s)</p>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION: EVOLUCIÓN DE VENTAS */}
          <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Evolución de Ventas y Rendimiento</span>
              </h2>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span>Ventas totales: <strong className="text-slate-900">{report.sales.totalSalesCount}</strong></span>
                <span>Ticket promedio: <strong className="text-emerald-700">${Math.round(report.sales.averageTicket).toLocaleString('es-AR')}</strong></span>
              </div>
            </div>

            {report.sales.dailySalesSeries.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No hay registro de ventas en este período.</p>
            ) : (
              <div className="pt-4 space-y-2">
                <div className="h-44 flex items-end gap-2 overflow-x-auto pb-2 px-1">
                  {(() => {
                    const maxRev = Math.max(...report.sales.dailySalesSeries.map(d => d.revenue), 1);
                    return report.sales.dailySalesSeries.map((d) => {
                      const heightPct = Math.max(8, Math.round((d.revenue / maxRev) * 100));
                      return (
                        <div key={d.date} className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group">
                          <span className="text-[9px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            ${d.revenue >= 1000 ? `${Math.round(d.revenue / 1000)}k` : d.revenue}
                          </span>
                          <div className="w-full bg-slate-100 rounded-t-xl overflow-hidden flex items-end h-32">
                            <div
                              className="w-full bg-emerald-600 group-hover:bg-emerald-500 transition-all rounded-t-xl"
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 truncate">{d.displayDate}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* SECTION: RANKINGS DE PRODUCTOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* TOP VENDIDOS */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>🏆 Productos Más Vendidos</span>
              </h2>

              {report.topProductsByQty.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Sin ventas registradas en el período.</p>
              ) : (
                <div className="space-y-2">
                  {report.topProductsByQty.map((prod, idx) => (
                    <div key={prod.productId} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          idx === 0 ? 'bg-amber-400 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{prod.name}</h4>
                          <p className="text-[10px] text-slate-500">{prod.brand} {prod.presentation}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-700">${prod.totalRevenue.toLocaleString('es-AR')}</span>
                        <p className="text-[10px] text-slate-500 font-bold">{prod.quantitySold} u.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TOP MARGEN */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>📈 Productos con Mayor Margen</span>
              </h2>

              {report.topProductsByMargin.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No hay productos con margen y costo calculado.</p>
              ) : (
                <div className="space-y-2">
                  {report.topProductsByMargin.map((prod) => (
                    <div key={prod.productId} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{prod.name}</h4>
                        <p className="text-[10px] text-slate-500">
                          Costo: ${prod.costPrice?.toLocaleString('es-AR')} | Venta: ${prod.salePrice.toLocaleString('es-AR')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-700">+{prod.marginPercent}%</span>
                        <p className="text-[10px] text-emerald-800 font-bold">+${prod.marginAmount?.toLocaleString('es-AR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION: COMPARATIVA DE COSTOS POR PRODUCTO (INTERACTIVO) */}
          <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <span>💲 Comparativa de Costos por Proveedor</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Seleccioná un producto para evaluar el historial de precios recibidos.</p>
              </div>

              {/* Product selector */}
              <div className="w-full sm:w-72">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="" disabled>Seleccionar producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.brand ? `(${p.brand})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingHistory ? (
              <div className="py-6 text-center text-xs text-slate-500 font-medium">Buscando historial de compras...</div>
            ) : !selectedProductObj ? (
              <p className="text-xs text-slate-400 py-4">Seleccioná un producto para consultar.</p>
            ) : costHistory && costHistory.items.length > 0 ? (
              <div className="space-y-3">
                {costHistory.bestCost && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-800">Mejor Costo Histórico Registrado</span>
                        <p className="text-xs font-bold text-slate-900">{costHistory.bestCost.providerName}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-800">
                      ${costHistory.bestCost.unitCost.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase">
                        <th className="py-2 px-3">Proveedor</th>
                        <th className="py-2 px-3">Costo Unitario</th>
                        <th className="py-2 px-3">Cantidad Comprada</th>
                        <th className="py-2 px-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {costHistory.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 font-semibold text-slate-800">
                          <td className="py-2.5 px-3">{item.providerName}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">${item.unitCost.toLocaleString('es-AR')}</td>
                          <td className="py-2.5 px-3 text-slate-600">{item.quantity} u.</td>
                          <td className="py-2.5 px-3 text-slate-500">{new Date(item.purchaseDate).toLocaleDateString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                No hay compras registradas en historial para <strong className="text-slate-800">{selectedProductObj.name}</strong>.
              </div>
            )}
          </div>

          {/* SECTION: PROVEEDORES & COMPRAS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PROVEEDORES */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600" />
                <span>🏪 Compras por Proveedor</span>
              </h2>

              {report.purchases.supplierBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Sin compras en este período.</p>
              ) : (
                <div className="space-y-2">
                  {report.purchases.supplierBreakdown.map((sup) => (
                    <div key={sup.supplierId} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{sup.supplierName}</h4>
                        <p className="text-[10px] text-slate-500">{sup.orderCount} orden(es) | {sup.totalItemsCount} u.</p>
                      </div>
                      <span className="text-xs font-black text-slate-900">${sup.totalAmount.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GASTOS OPERATIVOS CATEGORIAS */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                <span>📉 Gastos por Categoría</span>
              </h2>

              {report.expenses.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Sin gastos operativos en este período.</p>
              ) : (
                <div className="space-y-2">
                  {report.expenses.categoryBreakdown.map((cat) => (
                    <div key={cat.category} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{cat.category}</h4>
                        <p className="text-[10px] text-slate-500">{cat.count} reg. ({cat.percentage}%)</p>
                      </div>
                      <span className="text-xs font-black text-rose-700">${cat.amount.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION: CUENTA CORRIENTE & CAJA SUMMARY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CUENTA CORRIENTE */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>👥 Estado de Cuenta Corriente</span>
                </h2>
                <button
                  onClick={() => onNavigate('customers')}
                  className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-0.5"
                >
                  <span>Ir a Clientes</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-1">
                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100">
                  <span className="text-[10px] uppercase text-purple-700 font-extrabold">Deuda Total Activa</span>
                  <p className="text-base font-black text-purple-900">${report.customerDebt.totalDebtBalance.toLocaleString('es-AR')}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] uppercase text-emerald-700 font-extrabold">Cobrado en Período</span>
                  <p className="text-base font-black text-emerald-900">${report.customerDebt.periodPaymentsReceived.toLocaleString('es-AR')}</p>
                </div>
              </div>

              <h4 className="text-[11px] font-extrabold uppercase text-slate-500 pt-2">Mayores Deudores</h4>
              {report.customerDebt.topDebtors.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No hay clientes con deuda pendiente.</p>
              ) : (
                <div className="space-y-1.5">
                  {report.customerDebt.topDebtors.map((deb) => (
                    <div key={deb.customerId} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{deb.customerName}</span>
                      <span className="font-black text-purple-900">${deb.currentDebt.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RESUMEN DE CAJA & INVENTARIO */}
            <div className="space-y-4">
              {/* CAJA */}
              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <span>💰 Saldo Esperado en Caja</span>
                  </h2>
                  <button
                    onClick={() => onNavigate('cash')}
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                  >
                    <span>Ir a Caja</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Saldo Total Consolidado:</span>
                  <span className="text-lg font-black text-emerald-400">${report.cash.totalBalance.toLocaleString('es-AR')}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Efectivo</span>
                    <strong className="text-slate-900">${report.cash.cashBalance.toLocaleString('es-AR')}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Mercado Pago</span>
                    <strong className="text-slate-900">${report.cash.mercadoPagoBalance.toLocaleString('es-AR')}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Transferencia</span>
                    <strong className="text-slate-900">${report.cash.transferBalance.toLocaleString('es-AR')}</strong>
                  </div>
                </div>
              </div>

              {/* INVENTARIO */}
              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    <span>📦 Inventario de Productos</span>
                  </h2>
                  <button
                    onClick={() => onNavigate('stock')}
                    className="text-xs font-bold text-indigo-700 hover:underline flex items-center gap-0.5"
                  >
                    <span>Ir a Stock</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Productos</span>
                    <strong className="text-sm font-black text-slate-900">{report.inventory.totalProducts}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Unidades</span>
                    <strong className="text-sm font-black text-slate-900">{report.inventory.totalUnits}</strong>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-200">
                    <span className="text-[10px] text-rose-700 font-bold block">Sin Stock</span>
                    <strong className="text-sm font-black text-rose-900">{report.inventory.outOfStockCount}</strong>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-200">
                    <span className="text-[10px] text-amber-700 font-bold block">Stock Bajo</span>
                    <strong className="text-sm font-black text-amber-900">{report.inventory.lowStockCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
