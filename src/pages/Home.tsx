import React, { useMemo, useState } from 'react';
import { NavigationTab, Product } from '../types/product';
import { ScanLine, Search, Package, PlusCircle, ShieldCheck, Layers, ArrowRight, Barcode, Database, CheckCircle2, ShoppingCart } from 'lucide-react';
import { ProductCard } from '../components/product/ProductCard';

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
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const recentProducts = [...products].slice(-4).reverse();

  // Dynamic category calculations for insights card
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      const cat = p.category || 'Otros';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = products.length || 1;
    return sorted.slice(0, 3).map(([category, count]) => ({
      category,
      count,
      percentage: Math.min(100, Math.round((count / total) * 100)),
    }));
  }, [products]);

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('search');
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Bento Grid Container */}
      <div className="grid grid-cols-12 gap-4">

        {/* 1. Header / Branding Bento Card */}
        <div className="col-span-12 md:col-span-4 bento-card justify-between border-emerald-100 hover:border-emerald-300">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-3 rounded-2xl shadow-md text-white">
              <Barcode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl leading-none text-slate-900 tracking-tight">
                Despensa Stock
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                  v1.0.0 Stable
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 leading-relaxed font-medium">
            Sistema inteligente para escaneo de códigos EAN/UPC y control centralizado de productos.
          </p>
        </div>

        {/* 2. Quick Search Bento Module */}
        <div className="col-span-12 md:col-span-5 bento-card justify-center">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Buscador de productos</span>
            <span className="text-[10px] text-slate-400 font-mono">EAN / Nombre</span>
          </label>
          <form onSubmit={handleQuickSearchSubmit} className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-5 w-5" />
            </span>
            <input
              type="text"
              value={quickSearchQuery}
              onChange={(e) => setQuickSearchQuery(e.target.value)}
              onFocus={() => onNavigate('search')}
              placeholder="Buscar por nombre, marca o EAN..."
              className="block w-full pl-11 pr-10 py-3 border border-slate-200 rounded-2xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm text-slate-900 font-medium transition-all"
            />
            <button
              type="submit"
              className="absolute inset-y-1.5 right-1.5 px-3 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1"
            >
              Ir
            </button>
          </form>
        </div>

        {/* 3. Firebase Cloud Sync Status Bento Card */}
        <div className="col-span-12 md:col-span-3 bento-card justify-between border-slate-200">
          <div className="flex justify-between items-center">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              Firebase Cloud
            </div>
            <div className="flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              <span className="status-dot"></span> Sincronizado
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {products.length}{' '}
              <span className="text-xs font-semibold text-slate-400 tracking-normal uppercase">
                Productos
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 font-bold mt-1">
              Stock total: {products.reduce((acc, p) => acc + (p.stockQuantity || 0), 0)} unidades
            </p>
          </div>
        </div>

        {/* 4. Scanner Primary Hero Bento Card */}
        <div className="col-span-12 lg:col-span-5 bento-card p-0 overflow-hidden relative border-2 border-emerald-500/80 shadow-md group">
          <div className="bg-slate-950 flex flex-col h-full min-h-[320px]">
            {/* Camera Frame Visual Simulation */}
            <div className="flex-1 relative flex items-center justify-center p-6 min-h-[200px] overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950/40">
              <div className="w-56 h-36 border-2 border-white/30 rounded-3xl relative flex items-center justify-center backdrop-blur-xs">
                <div className="scan-line absolute w-full"></div>
                <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                
                <div className="text-center p-2">
                  <ScanLine className="w-8 h-8 text-emerald-400 mx-auto animate-pulse" />
                  <span className="text-[10px] text-emerald-300 font-mono mt-1 block">LECTOR ZBAR / HTML5</span>
                </div>
              </div>
              
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <p className="text-white/80 text-[10px] font-semibold uppercase tracking-widest bg-slate-900/80 inline-block px-3 py-1 rounded-full border border-white/10">
                  Alinee el código de barras comercial
                </p>
              </div>
            </div>

            {/* Scanner Action Controls Container */}
            <div className="bg-white p-5 rounded-t-3xl border-t border-slate-100 flex flex-col justify-between space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    Escanear Código
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Lector automático de cámara activa</p>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <button
                onClick={() => onNavigate('scan')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.99] group-hover:bg-emerald-500 cursor-pointer"
              >
                <ScanLine className="w-5 h-5" />
                <span className="tracking-wide">ACTIVAR CÁMARA Y ESCANEAR</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5. Recent Items Bento Card */}
        <div className="col-span-12 lg:col-span-7 bento-card justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-extrabold text-lg text-slate-900">Productos Recientes</h2>
              <p className="text-xs text-slate-500">Últimas altas registradas en el catálogo</p>
            </div>
            <button
              onClick={() => onNavigate('list')}
              className="text-emerald-600 font-bold text-xs hover:underline flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100"
            >
              Ver todos ({products.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onClick={() => onSelectProduct(p)}
                  showActions={false}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">Aún no hay productos guardados</p>
              <p className="text-[11px] text-slate-400 mt-1">Escanea tu primer producto para comenzar</p>
            </div>
          )}

          {/* Quick Manual Entry Trigger Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">¿Sin el producto físico?</span>
            <button
              onClick={onManualAdd}
              className="text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              Carga Manual Directa
            </button>
          </div>
        </div>

        {/* 6. Popular Categories Stats Bento Card */}
        <div className="col-span-12 md:col-span-4 bento-card justify-between">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 mb-1">Categorías Principales</h3>
            <p className="text-xs text-slate-500 mb-4">Distribución de stock por rubro</p>
            
            <div className="space-y-3">
              {categoryStats.length > 0 ? (
                categoryStats.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-medium">{item.category}</span>
                      <span className="font-bold text-slate-900">{item.count} un.</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center">Sin datos de categorías</div>
              )}
            </div>
          </div>

          <div className="mt-4 text-[11px] text-slate-400 border-t border-slate-100 pt-3 flex justify-between">
            <span>Variedad total</span>
            <span className="font-bold text-slate-700">{categoryStats.length} Rubros</span>
          </div>
        </div>

        {/* 7. Quick Navigation Bento Card (Dark Theme Variant) */}
        <div className="col-span-12 md:col-span-4 bento-card bg-emerald-950 text-white border-0 shadow-lg justify-between">
          <div>
            <h3 className="font-extrabold text-base mb-1 text-white">Navegación Rápida</h3>
            <p className="text-xs text-emerald-200/80 mb-4">Accesos directos de la aplicación</p>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onNavigate('sales')}
                className="bg-emerald-500 hover:bg-emerald-400 p-2.5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors text-slate-950 font-bold border border-emerald-400 col-span-3 mb-1"
              >
                <ShoppingCart className="w-5 h-5 mb-1 text-slate-950" />
                <span className="text-xs font-black">NUEVA VENTA (CARRITO)</span>
              </button>

              <button
                onClick={() => onNavigate('home')}
                className="bg-emerald-900/80 hover:bg-emerald-800 p-2.5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors border border-emerald-800/60"
              >
                <Barcode className="w-4 h-4 mb-1 text-emerald-300" />
                <span className="text-[11px] font-bold text-white">Inicio</span>
              </button>

              <button
                onClick={() => onNavigate('scan')}
                className="bg-emerald-900/80 hover:bg-emerald-800 p-2.5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors border border-emerald-800/60"
              >
                <ScanLine className="w-4 h-4 mb-1 text-emerald-300" />
                <span className="text-[11px] font-bold text-white">Escáner</span>
              </button>

              <button
                onClick={() => onNavigate('list')}
                className="bg-emerald-900/80 hover:bg-emerald-800 p-2.5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors border border-emerald-800/60"
              >
                <Package className="w-4 h-4 mb-1 text-emerald-300" />
                <span className="text-[11px] font-bold text-white">Catálogo</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-900 text-[10px] text-emerald-300/70 font-mono text-center">
            PWA OFF-LINE READY
          </div>
        </div>

        {/* 8. Architecture & Scalability Bento Info Card */}
        <div className="col-span-12 md:col-span-4 bento-card justify-between border-slate-200">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-1">
              <Layers className="w-4 h-4 text-emerald-600" />
              Gestión de Stock Activa
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mt-2">
              Inventario físico en tiempo real habilitado. Permite sumar, restar y establecer stock durante el escaneo o catálogo, previniendo valores negativos.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Módulo de Stock</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
              ACTIVO
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

