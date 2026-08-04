import React, { useState, useEffect, useMemo } from 'react';
import { Product, CreateProductInput } from '../types/product';
import { PurchaseEntry } from '../components/stock/PurchaseEntry';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { ProductCard } from '../components/product/ProductCard';
import { ProductForm } from '../components/product/ProductForm';
import { StockManager } from '../components/product/StockManager';
import { productService } from '../services/firebase/productService';
import { providerService } from '../services/firebase/providerService';
import { getProductByBarcodeExternal } from '../services/externalApi/productApiService';
import { NumericInput } from '../components/common/NumericInput';
import { playScanSound } from '../utils/audio';
import { 
  Boxes, 
  Box, 
  Truck, 
  ScanLine, 
  ArrowLeft, 
  RefreshCw, 
  Database, 
  Globe, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Filter,
  Package,
  Layers,
  Search,
  Calendar,
  Building2,
  X,
  Camera,
  ListFilter,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

interface StockPageProps {
  products: Product[];
  onProductsUpdated: (updatedProducts: Product[]) => void;
  onProductSaved: (product: Product) => void;
  onBackToHome: () => void;
  initialMode?: 'single' | 'purchase' | 'all_products';
}

export type StockSubMode = 'single' | 'purchase' | 'all_products';

type ScanStage = 
  | 'scanning'
  | 'searching_firebase'
  | 'found_firebase'
  | 'searching_external'
  | 'found_external'
  | 'not_found'
  | 'manual_form';

export const StockPage: React.FC<StockPageProps> = ({
  products,
  onProductsUpdated,
  onProductSaved,
  onBackToHome,
  initialMode = 'single',
}) => {
  const [subMode, setSubMode] = useState<StockSubMode>(initialMode);

  // Single mode scan states
  const [stage, setStage] = useState<ScanStage>('scanning');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [manualEanInput, setManualEanInput] = useState<string>('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [externalProduct, setExternalProduct] = useState<CreateProductInput | null>(null);
  const [externalInitialStock, setExternalInitialStock] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingExternal, setIsSavingExternal] = useState(false);

  // Camera Scanner active toggle (by default false so camera feed is not displayed until user clicks button)
  const [isCameraScannerActive, setIsCameraScannerActive] = useState<boolean>(false);

  // All Products View Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [stockLevelFilter, setStockLevelFilter] = useState<'all' | 'zero' | 'low' | 'available'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [entryTypeFilter, setEntryTypeFilter] = useState<'all' | 'single' | 'purchase'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name' | 'stock_high' | 'stock_low'>('recent');

  // Stock Adjustment Modal for All Products tab
  const [productForStockAdjust, setProductForStockAdjust] = useState<Product | null>(null);

  // Providers list for filtering
  const [providersList, setProvidersList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    // Load registered providers
    providerService.getAllProviders().then((list) => {
      setProvidersList(list.map((p) => ({ id: p.id, name: p.name })));
    }).catch((err) => console.warn('Error loading providers:', err));
  }, []);

  // Reset scanner state
  const resetScan = () => {
    setStage('scanning');
    setScannedBarcode('');
    setManualEanInput('');
    setFoundProduct(null);
    setExternalProduct(null);
    setExternalInitialStock(1);
    setErrorMessage(null);
    setIsCameraScannerActive(false);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setIsCameraScannerActive(false); // Hide scanner once scanned
    setScannedBarcode(barcode);
    setManualEanInput(barcode);
    setErrorMessage(null);
    setStage('searching_firebase');

    try {
      const localMatch = await productService.getByBarcode(barcode);
      if (localMatch) {
        setFoundProduct(localMatch);
        setStage('found_firebase');
        playScanSound('found');
        return;
      }
    } catch (err) {
      console.warn('Firebase lookup error:', err);
    }

    setStage('searching_external');

    try {
      const externalResult = await getProductByBarcodeExternal(barcode);
      if (externalResult.found && externalResult.product) {
        const ext = externalResult.product;
        setExternalProduct({
          barcode: ext.barcode,
          name: ext.name,
          brand: ext.brand,
          category: ext.category,
          presentation: ext.presentation,
          description: ext.description,
          imageUrl: ext.imageUrl,
          source: 'external_api',
        });
        setStage('found_external');
        playScanSound('found');
        return;
      }
    } catch (err) {
      console.warn('External API error:', err);
    }

    playScanSound('error');
    setStage('not_found');
  };

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEan = manualEanInput.trim();
    if (!cleanEan) return;
    handleBarcodeScanned(cleanEan);
  };

  const handleSaveExternalProduct = async () => {
    if (!externalProduct) return;
    setIsSavingExternal(true);

    try {
      const saved = await productService.saveProduct({
        ...externalProduct,
        stockQuantity: externalInitialStock,
      });
      setFoundProduct(saved);
      onProductSaved(saved);
      setStage('found_firebase');
      playScanSound('success');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al guardar el producto');
    } finally {
      setIsSavingExternal(false);
    }
  };

  const handleManualFormSubmit = async (inputData: CreateProductInput) => {
    const saved = await productService.saveProduct(inputData);
    setFoundProduct(saved);
    onProductSaved(saved);
    setStage('found_firebase');
    playScanSound('success');
  };

  // Provider options extracted from both providers collection and unique names in products
  const providerOptions = useMemo(() => {
    const setNames = new Set<string>();
    providersList.forEach((p) => setNames.add(p.name));
    products.forEach((p) => {
      if (p.lastSupplierName) setNames.add(p.lastSupplierName);
    });
    return Array.from(setNames).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [providersList, products]);

  // Filtered products calculation for "all_products" tab
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchBrand = p.brand?.toLowerCase().includes(q) || false;
        const matchEan = p.barcode.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchEan) return false;
      }

      // 2. Provider Filter
      if (selectedProvider !== 'all') {
        if (selectedProvider === 'none') {
          if (p.lastSupplierName || p.lastSupplierId || p.supplierId) return false;
        } else {
          const provName = p.lastSupplierName || '';
          if (provName.toLowerCase() !== selectedProvider.toLowerCase()) return false;
        }
      }

      // 3. Stock Level Filter
      const qty = p.stockQuantity || 0;
      if (stockLevelFilter === 'zero' && qty !== 0) return false;
      if (stockLevelFilter === 'low' && (qty === 0 || qty > 5)) return false;
      if (stockLevelFilter === 'available' && qty <= 0) return false;

      // 4. Date Filter
      if (dateFilter !== 'all') {
        const productDate = new Date(p.lastPurchaseDate || p.createdAt || p.updatedAt);
        const now = new Date();

        if (dateFilter === 'today') {
          const isToday = productDate.toISOString().split('T')[0] === now.toISOString().split('T')[0];
          if (!isToday) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (productDate < sevenDaysAgo) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (productDate < thirtyDaysAgo) return false;
        }
      }

      // 5. Entry Type / Origin Filter
      if (entryTypeFilter !== 'all') {
        const isPurchaseEntry = p.source === 'purchase_entry' || Boolean(p.lastPurchaseDate);
        if (entryTypeFilter === 'purchase' && !isPurchaseEntry) return false;
        if (entryTypeFilter === 'single' && isPurchaseEntry) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'recent') {
        const dateA = new Date(a.lastPurchaseDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.lastPurchaseDate || b.createdAt || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        const dateA = new Date(a.lastPurchaseDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.lastPurchaseDate || b.createdAt || 0).getTime();
        return dateA - dateB;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'stock_high') {
        return (b.stockQuantity || 0) - (a.stockQuantity || 0);
      }
      if (sortBy === 'stock_low') {
        return (a.stockQuantity || 0) - (b.stockQuantity || 0);
      }
      return 0;
    });
  }, [
    products,
    searchQuery,
    selectedProvider,
    stockLevelFilter,
    dateFilter,
    entryTypeFilter,
    sortBy,
  ]);

  const hasActiveFilters = 
    searchQuery !== '' || 
    selectedProvider !== 'all' || 
    stockLevelFilter !== 'all' || 
    dateFilter !== 'all' || 
    entryTypeFilter !== 'all';

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedProvider('all');
    setStockLevelFilter('all');
    setDateFilter('all');
    setEntryTypeFilter('all');
    setSortBy('recent');
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-full transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Inicio
        </button>

        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Boxes className="w-5 h-5 text-emerald-600" />
          Gestión de Stock
        </h2>

        {subMode === 'single' && stage !== 'scanning' ? (
          <button
            onClick={resetScan}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        ) : (
          <div className="w-16"></div>
        )}
      </div>

      {/* Main Mode Selection Header Tabs */}
      <div className="bg-white p-2.5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 pt-1">
          Operación o Consulta de Stock
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Submode 1: Single */}
          <button
            onClick={() => setSubMode('single')}
            className={`p-3 rounded-2xl border transition-all text-left flex items-start gap-2.5 ${
              subMode === 'single'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/80'
                : 'bg-slate-50 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${
              subMode === 'single' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">1. CARGA INDIVIDUAL</h3>
              <p className="text-[10px] text-slate-500 leading-snug">
                Ajuste directo por escaneo o EAN
              </p>
            </div>
          </button>

          {/* Submode 2: Purchase */}
          <button
            onClick={() => setSubMode('purchase')}
            className={`p-3 rounded-2xl border transition-all text-left flex items-start gap-2.5 ${
              subMode === 'purchase'
                ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/80'
                : 'bg-slate-50 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${
              subMode === 'purchase' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">2. INGRESO MERCADERÍA</h3>
              <p className="text-[10px] text-slate-500 leading-snug">
                Recepción por proveedor y remito
              </p>
            </div>
          </button>

          {/* Submode 3: All Products */}
          <button
            onClick={() => setSubMode('all_products')}
            className={`p-3 rounded-2xl border transition-all text-left flex items-start gap-2.5 ${
              subMode === 'all_products'
                ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-800'
                : 'bg-slate-50 border-slate-200 hover:border-slate-400 hover:bg-slate-100'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${
              subMode === 'all_products' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-200 text-slate-600'
            }`}>
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-xs font-extrabold ${subMode === 'all_products' ? 'text-white' : 'text-slate-900'}`}>
                3. PRODUCTOS CARGADOS
              </h3>
              <p className={`text-[10px] leading-snug ${subMode === 'all_products' ? 'text-slate-300' : 'text-slate-500'}`}>
                Ver todos ({products.length}) con filtros
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* MODE 2: NUEVO INGRESO DE MERCADERÍA */}
      {subMode === 'purchase' && (
        <PurchaseEntry
          products={products}
          onProductsUpdated={onProductsUpdated}
          onBackToHome={onBackToHome}
        />
      )}

      {/* MODE 3: TODOS LOS PRODUCTOS CARGADOS CON FILTROS */}
      {subMode === 'all_products' && (
        <div className="space-y-4">
          {/* FILTERS PANEL */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Filtros de Búsqueda y Control
                </h3>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-xl"
                >
                  <X className="w-3.5 h-3.5" /> Limpiar Filtros
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, marca o código EAN..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* 1. Por Proveedor */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" /> Proveedor
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="all">Todos los Proveedores</option>
                  <option value="none">Sin Proveedor Asignado</option>
                  {providerOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Por Unidades en Stock */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-400" /> Unidades en Stock
                </label>
                <select
                  value={stockLevelFilter}
                  onChange={(e) => setStockLevelFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="all">Todos los niveles</option>
                  <option value="zero">Sin Stock (0 un.)</option>
                  <option value="low">Stock Bajo (1 a 5 un.)</option>
                  <option value="available">Con Stock ({'>'} 0 un.)</option>
                </select>
              </div>

              {/* 3. Por Fecha de Carga */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Fecha de Carga
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="all">Todas las fechas</option>
                  <option value="today">Cargados Hoy</option>
                  <option value="7days">Últimos 7 días</option>
                  <option value="30days">Últimos 30 días</option>
                </select>
              </div>

              {/* 4. Por Tipo de Carga / Origen */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <ListFilter className="w-3 h-3 text-slate-400" /> Tipo de Carga
                </label>
                <select
                  value={entryTypeFilter}
                  onChange={(e) => setEntryTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="all">Todos los Orígenes</option>
                  <option value="single">Carga Individual / Manual</option>
                  <option value="purchase">Ingreso Mercadería (Varios)</option>
                </select>
              </div>
            </div>

            {/* Sorting Row */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 font-semibold">
                Mostrando <strong className="text-slate-900 font-mono">{filteredProducts.length}</strong> de {products.length} productos
              </span>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="recent">Más recientes primero</option>
                  <option value="oldest">Más antiguos primero</option>
                  <option value="name">Nombre A-Z</option>
                  <option value="stock_high">Mayor stock</option>
                  <option value="stock_low">Menor stock</option>
                </select>
              </div>
            </div>
          </div>

          {/* PRODUCTS LIST */}
          {filteredProducts.length === 0 ? (
            <div className="p-10 bg-white border border-slate-200 rounded-3xl text-center space-y-2">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No se encontraron productos</h3>
              <p className="text-xs text-slate-500">Prueba cambiando los criterios de filtro o limpia los filtros activos.</p>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="mt-2 py-2 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map((p) => {
                const isPurchaseType = p.source === 'purchase_entry' || Boolean(p.lastPurchaseDate);
                const qty = p.stockQuantity || 0;

                return (
                  <div
                    key={p.id}
                    className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-12 h-12 rounded-2xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-bold text-base">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <h4 className="text-xs font-black text-slate-900 line-clamp-1">{p.name}</h4>
                            <p className="text-[11px] text-slate-500">{p.brand} • {p.category}</p>
                            <p className="text-[10px] font-mono text-slate-400">EAN: {p.barcode}</p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-mono font-black px-2.5 py-1 rounded-xl shrink-0 ${
                            qty === 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : qty <= 5
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {qty} un.
                        </span>
                      </div>

                      {/* BADGES & DETAILS ROW */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-slate-400 font-medium block">Proveedor:</span>
                          <span className="font-bold text-slate-700 truncate block">
                            {p.lastSupplierName || 'Sin asignar'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 font-medium block">Tipo Carga:</span>
                          <span
                            className={`font-bold rounded-md px-1.5 py-0.5 inline-block ${
                              isPurchaseType
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isPurchaseType ? 'Ingreso Varios' : 'Carga Individual'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 font-medium block">Precio Venta:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            ${p.salePrice ? p.salePrice.toLocaleString('es-AR') : '0'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 font-medium block">Fecha Carga:</span>
                          <span className="font-mono font-semibold text-slate-600">
                            {new Date(p.lastPurchaseDate || p.createdAt || p.updatedAt).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ACTION BUTTON */}
                    <button
                      onClick={() => setProductForStockAdjust(p)}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      Ajustar Stock Rápido
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODE 1: CARGA INDIVIDUAL / AJUSTE DE STOCK */}
      {subMode === 'single' && (
        <div className="space-y-4">
          {/* 1. INITIAL SCANNING LANDING PANEL (WITH BUTTON & MANUAL INPUT) */}
          {stage === 'scanning' && (
            <div className="space-y-4">
              {/* Camera Scanner Control Panel */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Escanear Código de Barras</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Presiona el botón para encender la cámara o ingresa el código EAN manualmente.
                  </p>
                </div>

                {/* Camera Toggle Button */}
                {!isCameraScannerActive ? (
                  <button
                    onClick={() => setIsCameraScannerActive(true)}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Camera className="w-4 h-4" />
                    ACTIVAR CÁMARA ESCÁNER
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => setIsCameraScannerActive(false)}
                      className="w-full py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-extrabold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" /> Ocultar Escáner Cámara
                    </button>

                    <BarcodeScanner
                      onScanSuccess={handleBarcodeScanned}
                      isScanningActive={isCameraScannerActive}
                    />
                  </div>
                )}
              </div>

              {/* Manual EAN Input Fallback */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider text-center">
                  O Ingresar EAN Manualmente
                </h4>

                <form onSubmit={handleManualSearchSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={manualEanInput}
                    onChange={(e) => setManualEanInput(e.target.value)}
                    placeholder="Ej: 7791234567890"
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!manualEanInput.trim()}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl transition-colors shrink-0"
                  >
                    Buscar
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 2. SEARCHING FIREBASE */}
          {stage === 'searching_firebase' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
              <Database className="w-8 h-8 text-emerald-600 animate-bounce mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">Buscando en catálogo local...</h3>
              <p className="text-xs text-slate-500 font-mono">EAN: {scannedBarcode}</p>
            </div>
          )}

          {/* 3. FOUND IN FIREBASE -> SHOW PRODUCT + STOCK MANAGER */}
          {stage === 'found_firebase' && foundProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Producto encontrado en catálogo
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  EAN: {foundProduct.barcode}
                </span>
              </div>

              <ProductCard
                product={foundProduct}
                showActions={false}
              />

              <StockManager
                product={foundProduct}
                onStockUpdated={(updated) => {
                  setFoundProduct(updated);
                  onProductSaved(updated);
                }}
              />

              <button
                onClick={resetScan}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Escanear Otro Producto
              </button>
            </div>
          )}

          {/* 4. SEARCHING EXTERNAL */}
          {stage === 'searching_external' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
              <Globe className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">Buscando en API Externa (OpenFoodFacts)...</h3>
              <p className="text-xs text-slate-500 font-mono">EAN: {scannedBarcode}</p>
            </div>
          )}

          {/* 5. FOUND IN EXTERNAL API */}
          {stage === 'found_external' && externalProduct && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Información obtenida de API externa
                </span>
                <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                  NUEVO
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-extrabold text-slate-900">{externalProduct.name}</h3>
                <p className="text-xs text-slate-500">Marca: <span className="font-bold text-slate-800">{externalProduct.brand}</span> • Categoría: <span className="font-bold text-slate-800">{externalProduct.category}</span></p>
                <p className="text-xs text-slate-400 font-mono">EAN: {externalProduct.barcode}</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Stock Inicial</label>
                <NumericInput
                  min="0"
                  allowDecimal={false}
                  value={externalInitialStock}
                  onChangeValue={(val) => setExternalInitialStock(val)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {errorMessage && (
                <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-3 rounded-xl">{errorMessage}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={resetScan}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveExternalProduct}
                  disabled={isSavingExternal}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1"
                >
                  <Save className="w-4 h-4" /> Guardar en Catálogo
                </button>
              </div>
            </div>
          )}

          {/* 6. NOT FOUND ANYWHERE -> TRIGGER MANUAL FORM */}
          {stage === 'not_found' && (
            <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-sm text-center space-y-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Producto No Registrado</h3>
                <p className="text-xs text-slate-500 mt-1">
                  El código <span className="font-mono font-bold text-slate-800">{scannedBarcode}</span> no existe en la base de datos ni en la API externa.
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={resetScan}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Reintentar Escaneo
                </button>
                <button
                  onClick={() => setStage('manual_form')}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1"
                >
                  <PlusCircle className="w-4 h-4" /> Crear Registro Manual
                </button>
              </div>
            </div>
          )}

          {/* 7. MANUAL FORM STAGE */}
          {stage === 'manual_form' && (
            <ProductForm
              initialBarcode={scannedBarcode}
              isEditing={false}
              source="manual"
              onSubmit={handleManualFormSubmit}
              onCancel={resetScan}
            />
          )}
        </div>
      )}

      {/* QUICK STOCK ADJUSTMENT MODAL FOR ALL PRODUCTS TAB */}
      {productForStockAdjust && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setProductForStockAdjust(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">Ajuste de Stock Rápido</span>
              <h3 className="text-base font-extrabold text-slate-900">{productForStockAdjust.name}</h3>
              <p className="text-xs text-slate-500">{productForStockAdjust.brand} • EAN: {productForStockAdjust.barcode}</p>
            </div>

            <StockManager
              product={productForStockAdjust}
              onStockUpdated={(updated) => {
                setProductForStockAdjust(updated);
                onProductSaved(updated);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
