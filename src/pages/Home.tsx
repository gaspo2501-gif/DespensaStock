import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavigationTab, Product } from '../types/product';
import { SaleRecord } from '../types/sale';
import { salesService } from '../services/firebase/salesService';
import { accountService } from '../services/firebase/accountService';
import { getArgentinaToday, toArgentinaDateString, formatLocalDateTime } from '../utils/dateUtils';
import { 
  ShoppingCart, 
  ScanLine, 
  Boxes, 
  Users, 
  DollarSign, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  Receipt, 
  Search, 
  Plus, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  ChevronRight,
  Wallet,
  BarChart3
} from 'lucide-react';

interface HomeProps {
  onNavigate: (tab: NavigationTab) => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onManualAdd: () => void;
}

export const Home: React.FC<HomeProps> = ({
  onNavigate,
  products,
  onSelectProduct,
  onManualAdd,
}) => {
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [totalDebts, setTotalDebts] = useState<number>(0);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>('');

  // Fetch sales and debts on mount
  const loadDashboardData = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const [salesData, balancesData] = await Promise.all([
        salesService.getRecentSales(),
        accountService.getAllBalances(),
      ]);

      setRecentSales(salesData);

      // Sum all customer balances for "Cuentas por cobrar"
      const debtSum = Object.values(balancesData).reduce((acc, curr) => acc + (curr > 0 ? curr : 0), 0);
      setTotalDebts(debtSum);
    } catch (err) {
      console.warn('Error al cargar datos del dashboard:', err);
    } fontally: {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Compute Today's Sales
  const todaySalesData = useMemo(() => {
    const todayStr = getArgentinaToday();
    const salesToday = recentSales.filter((s) => {
      const saleDateStr = s.date || toArgentinaDateString(s.createdAt);
      return saleDateStr === todayStr;
    });

    const totalAmountToday = salesToday.reduce((acc, s) => acc + s.totalAmount, 0);
    const countToday = salesToday.length;

    return {
      totalAmountToday,
      countToday,
      salesToday,
    };
  }, [recentSales]);

  // Compute total inventory stock
  const totalStockUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.stockQuantity || 0), 0);
  }, [products]);

  // Low or zero stock products
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => (p.stockQuantity || 0) <= 3).slice(0, 5);
  }, [products]);

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('search');
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto animate-fadeIn">
      {/* HEADER / WELCOME BANNER */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-md">
            <TrendingUp className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Panel de Gestión</h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                Despensa
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Indicadores comerciales y control diario en tiempo real</p>
          </div>
        </div>

        <button
          onClick={loadDashboardData}
          disabled={loadingDashboard}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors flex items-center gap-1.5 text-xs"
          title="Actualizar datos"
        >
          <RefreshCw className={`w-4 h-4 ${loadingDashboard ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* 2.1 KPI CARDS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Ventas de Hoy */}
        <div className="p-4 bg-emerald-700 text-white rounded-3xl shadow-md space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-100">
            <span className="text-[10px] font-black uppercase tracking-wider">Ventas de Hoy</span>
            <DollarSign className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono">
              ${todaySalesData.totalAmountToday.toLocaleString('es-AR')}
            </div>
            <p className="text-[11px] font-semibold text-emerald-200 mt-0.5">
              {todaySalesData.countToday} {todaySalesData.countToday === 1 ? 'venta realizada' : 'ventas realizadas'}
            </p>
          </div>
        </div>

        {/* Card 2: Productos Registrados */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider">Productos Catálogo</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900">
              {products.length}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              En catálogo activo
            </p>
          </div>
        </div>

        {/* Card 3: Stock Total */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider">Stock Total</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900">
              {totalStockUnits.toLocaleString('es-AR')}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Unidades en estantería
            </p>
          </div>
        </div>

        {/* Card 4: Cuentas por Cobrar */}
        <div className="p-4 bg-white border border-rose-200 bg-rose-50/40 rounded-3xl shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Cuentas por Cobrar</span>
            <Users className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-rose-700">
              ${totalDebts.toLocaleString('es-AR')}
            </div>
            <p className="text-[11px] font-semibold text-rose-600/80 mt-0.5">
              Deuda total fiada
            </p>
          </div>
        </div>
      </div>

      {/* 2.2 BOTONERA COMERCIAL (DAILY ACTIONS) */}
      <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
          Operaciones Frecuentes
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5">
          {/* Action 1: Nueva Venta */}
          <button
            onClick={() => onNavigate('sales')}
            className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold text-[11px] shadow-md transition-all flex flex-col items-center justify-center gap-1.5 text-center active:scale-98"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span>NUEVA VENTA</span>
          </button>

          {/* Action 2: Escáner */}
          <button
            onClick={() => onNavigate('scan')}
            className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-extrabold text-[11px] shadow-md transition-all flex flex-col items-center justify-center gap-1.5 text-center active:scale-98"
          >
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
              <ScanLine className="w-4 h-4" />
            </div>
            <span>ESCANEAR</span>
          </button>

          {/* Action 3: Caja */}
          <button
            onClick={() => onNavigate('cash')}
            className="p-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-[11px] shadow-md transition-all flex flex-col items-center justify-center gap-1.5 text-center active:scale-98"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-emerald-300">
              <Wallet className="w-4 h-4" />
            </div>
            <span>CAJA</span>
          </button>

          {/* Action 4: Reportes */}
          <button
            onClick={() => onNavigate('reports')}
            className="p-3 bg-cyan-700 hover:bg-cyan-600 text-white rounded-2xl font-extrabold text-[11px] shadow-md transition-all flex flex-col items-center justify-center gap-1.5 text-center active:scale-98"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-cyan-200">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span>REPORTES</span>
          </button>

          {/* Action 5: Stock */}
          <button
            onClick={() => onNavigate('stock')}
            className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-extrabold text-[11px] shadow-md transition-all flex flex-col items-center justify-center gap-1.5 text-center active:scale-98"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Boxes className="w-4 h-4" />
            </div>
            <span>STOCK</span>
          </button>

          {/* Action 6: Gastos */}
          <button
            onClick={() => onNavigate('expenses')}
            className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-extrabold text-[11px] shadow-md transition-all flex flex-col items-center justify-center gap-1.5 text-center active:scale-98"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Receipt className="w-4 h-4" />
            </div>
            <span>GASTOS</span>
          </button>

          {/* Action 7: Clientes */}
          <button
            onClick={() => onNavigate('customers')}
            className="p-3 bg-teal-700 hover:bg-teal-600 text-white rounded-2xl font-extrabold text-[11px] shadow-md transition-all flex flex-col items-center justify-center gap-1.5 text-center active:scale-98"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Users className="w-4 h-4" />
            </div>
            <span>CLIENTES</span>
          </button>
        </div>
      </div>

      {/* GRID SECTION: ALERTS & RECENT SALES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 2.3 SECCIÓN DE ESTADO / ALERTAS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900">Alertas de Stock Bajo / Cero</h3>
              </div>
              <button
                onClick={() => onNavigate('stock')}
                className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
              >
                Reponer <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="p-6 text-center bg-emerald-50/50 border border-emerald-100 rounded-2xl text-emerald-800 space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold">¡Inventario Excelente!</p>
                <p className="text-[11px] text-emerald-700/80">No tenés productos con faltante o stock crítico.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((p) => {
                  const qty = p.stockQuantity || 0;
                  const isZero = qty === 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => onSelectProduct(p)}
                      className="p-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="truncate pr-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{p.name}</h4>
                        <p className="text-[11px] text-slate-500">{p.brand} • EAN: {p.barcode}</p>
                      </div>

                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl border shrink-0 ${
                          isZero
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}
                      >
                        {qty === 0 ? 'Sin Stock (0)' : `${qty} un.`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Usa la carga rápida para actualizar las estanterías</span>
            <button
              onClick={onManualAdd}
              className="text-xs font-bold text-slate-800 hover:text-emerald-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo Producto
            </button>
          </div>
        </div>

        {/* 2.4 ÚLTIMAS VENTAS REGISTRADAS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Ventas Recientes</h3>
              </div>
              <button
                onClick={() => onNavigate('sales')}
                className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
              >
                Nueva Venta <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {recentSales.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 space-y-1">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">No hay ventas registradas aún.</p>
                <p className="text-[11px] text-slate-400">Iniciá una venta en el carrito para comenzar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSales.slice(0, 5).map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          ${sale.totalAmount.toLocaleString('es-AR')}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                            sale.paymentMethod === 'credit'
                              ? 'bg-amber-100 text-amber-800'
                              : sale.paymentMethod === 'mercado_pago'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {sale.paymentMethod === 'credit'
                            ? `Fiado (${sale.customerName || 'Cliente'})`
                            : sale.paymentMethod === 'mercado_pago'
                            ? 'MP'
                            : 'Efectivo'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {formatLocalDateTime(sale.createdAt)} • {sale.totalItemsCount} {sale.totalItemsCount === 1 ? 'item' : 'items'}
                      </p>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      #{sale.id.slice(-4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-right">
            <button
              onClick={() => onNavigate('sales')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center justify-end gap-1"
            >
              Ir al Carrito de Ventas <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
