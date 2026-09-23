import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, CreateProductInput, getStockForLocation, getProductStock, getTotalStock, StockOperation } from '../types/product';
import { PurchaseEntry } from '../components/stock/PurchaseEntry';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { ProductCard } from '../components/product/ProductCard';
import { ProductForm } from '../components/product/ProductForm';
import { StockManager } from '../components/product/StockManager';
import { StockTransferModal } from '../components/stock/StockTransferModal';
import { PurchaseHistoryModal } from '../components/modals/PurchaseHistoryModal';
import { TransferHistoryModal } from '../components/modals/TransferHistoryModal';
import { PurchaseDetailModal } from '../components/modals/PurchaseDetailModal';
import { StockTransferDetailModal } from '../components/modals/StockTransferDetailModal';
import { ProductDetailModal } from '../components/modals/ProductDetailModal';
import { StockTransferRecord } from '../types/stockTransfer';
import { productService } from '../services/firebase/productService';
import { providerService } from '../services/firebase/providerService';
import { getProductByBarcodeExternal } from '../services/externalApi/productApiService';
import { playScanSound } from '../utils/audio';
import { useLocation } from '../context/LocationContext';
import { getLocationName } from '../types/location';
import { toArgentinaDateString, getArgentinaToday, getArgentinaDaysAgo } from '../utils/dateUtils';
import { 
  Boxes, 
  Search, 
  Camera, 
  ArrowLeft, 
  RefreshCw, 
  Plus, 
  Minus, 
  Equal, 
  ArrowLeftRight, 
  History, 
  Truck, 
  Layers, 
  Barcode, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  SlidersHorizontal, 
  X, 
  Eye, 
  PackagePlus, 
  Filter,
  Check
} from 'lucide-react';

interface StockPageProps {
  products: Product[];
  onProductsUpdated: (updatedProducts: Product[]) => void;
  onProductSaved: (product: Product) => void;
  onBackToHome: () => void;
  initialMode?: 'products' | 'purchase' | 'transfers';
}

export type StockSubTab = 'products' | 'purchase' | 'transfers';

export const StockPage: React.FC<StockPageProps> = ({
  products,
  onProductsUpdated,
  onProductSaved,
  onBackToHome,
  initialMode = 'products',
}) => {
  const { activeLocation } = useLocation();
  const [subTab, setSubTab] = useState<StockSubTab>(initialMode);

  // Search & Scan States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Operational Selected Product
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activeAdjustOperation, setActiveAdjustOperation] = useState<StockOperation | null>(null);
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState<string | null>(null);

  // External product fallback states
  const [searchingExternal, setSearchingExternal] = useState<boolean>(false);
  const [externalNotFound, setExternalNotFound] = useState<string | null>(null);

  // Modals state
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState<boolean>(false);
  const [showTransferHistory, setShowTransferHistory] = useState<boolean>(false);
  const [selectedPurchaseIdForDetail, setSelectedPurchaseIdForDetail] = useState<string | null>(null);
  const [selectedTransferForDetail, setSelectedTransferForDetail] = useState<StockTransferRecord | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showManualCreateModal, setShowManualCreateModal] = useState<boolean>(false);

  // Filter States for Products Catalog
  const [stockLevelFilter, setStockLevelFilter] = useState<'all' | 'zero' | 'low' | 'available'>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock_high' | 'stock_low' | 'recent'>('name');

  // Providers list
  const [providersList, setProvidersList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    providerService.getAllProviders()
      .then((list) => setProvidersList(list.map((p) => ({ id: p.id, name: p.name }))))
      .catch((err) => console.warn('Error loading providers:', err));
  }, []);

  // Derive the currently selected product reactively from the global products array
  const activeProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Real-time matched products for the search suggestions dropdown
  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    return products.filter((p) => {
      const barcodeMatch = p.barcode.toLowerCase().includes(query);
      const nameMatch = p.name.toLowerCase().includes(query);
      const brandMatch = (p.brand || '').toLowerCase().includes(query);
      const presMatch = (p.presentation || '').toLowerCase().includes(query);
      return barcodeMatch || nameMatch || brandMatch || presMatch;
    }).slice(0, 8); // Top 8 matches
  }, [products, searchQuery]);

  // Handle direct barcode scan or selection
  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setActiveAdjustOperation(null);
    setAdjustSuccessMsg(null);
    setIsCameraActive(false);
    setSearchQuery('');
    setExternalNotFound(null);
    playScanSound('found');
  };

  // Handle barcode scanned from camera or USB input
  const handleBarcodeScanned = async (barcode: string) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;

    setIsCameraActive(false);
    setSearchQuery('');
    setAdjustSuccessMsg(null);
    setExternalNotFound(null);

    // 1. Look up in current products array first (fastest, in-memory)
    const exactMatch = products.find((p) => p.barcode === cleanBarcode);
    if (exactMatch) {
      handleSelectProduct(exactMatch);
      return;
    }

    // 2. Look up in Firestore
    try {
      const firestoreMatch = await productService.getByBarcode(cleanBarcode);
      if (firestoreMatch) {
        handleSelectProduct(firestoreMatch);
        return;
      }
    } catch (err) {
      console.warn('Firestore lookup error:', err);
    }

    // 3. Look up in external API
    setSearchingExternal(true);
    try {
      const extResult = await getProductByBarcodeExternal(cleanBarcode);
      if (extResult.found && extResult.product) {
        // Save external product immediately or allow user to create
        const newProduct = await productService.saveProduct({
          barcode: extResult.product.barcode,
          name: extResult.product.name,
          brand: extResult.product.brand || '',
          category: extResult.product.category || 'General',
          presentation: extResult.product.presentation || '',
          description: extResult.product.description || '',
          imageUrl: extResult.product.imageUrl,
          source: 'external_api',
          stockQuantity: 0,
          stockByLocation: { aimogasta: 0, olascoaga: 0 },
        });
        onProductSaved(newProduct);
        handleSelectProduct(newProduct);
        playScanSound('success');
        return;
      }
    } catch (err) {
      console.warn('External lookup failed:', err);
    } finally {
      setSearchingExternal(false);
    }

    // Product not found anywhere
    playScanSound('error');
    setExternalNotFound(cleanBarcode);
  };

  // Handle key press on search input (e.g. Enter from USB scanner)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = searchQuery.trim();
      if (!val) return;

      // If an exact barcode match exists:
      const exactBarcode = products.find((p) => p.barcode === val);
      if (exactBarcode) {
        handleSelectProduct(exactBarcode);
        return;
      }

      // If exactly 1 match in search results:
      if (searchMatches.length === 1) {
        handleSelectProduct(searchMatches[0]);
        return;
      }

      // If barcode-like digits, scan it:
      if (/^\d{6,14}$/.test(val)) {
        handleBarcodeScanned(val);
      }
    }
  };

  // Action: Next Product / Scan Next
  const handleScanNext = () => {
    setSelectedProductId(null);
    setActiveAdjustOperation(null);
    setAdjustSuccessMsg(null);
    setSearchQuery('');
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Callback when StockManager updates a product's stock
  const handleStockUpdated = (updated: Product) => {
    onProductSaved(updated);
    setAdjustSuccessMsg('Stock actualizado correctamente');
    playScanSound('success');
  };

  // Branch-aware filtered products for catalog list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Stock Level Filter (strictly evaluated for activeLocation!)
      const locQty = getProductStock(p, activeLocation);
      if (stockLevelFilter === 'zero' && locQty !== 0) return false;
      if (stockLevelFilter === 'low' && (locQty <= 0 || locQty > 5)) return false;
      if (stockLevelFilter === 'available' && locQty <= 0) return false;

      // 2. Provider Filter
      if (selectedProvider !== 'all') {
        const matchesProvider = 
          p.supplierId === selectedProvider || 
          p.lastSupplierId === selectedProvider ||
          p.lastSupplierName === selectedProvider;
        if (!matchesProvider) return false;
      }

      // 3. Category Filter
      if (selectedCategory !== 'all') {
        if (p.category.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }

      // 4. Date Filter
      if (dateFilter !== 'all') {
        const rawDate = p.lastPurchaseDate || p.createdAt || p.updatedAt;
        if (!rawDate) return false;
        const argDateStr = toArgentinaDateString(rawDate);
        const todayStr = getArgentinaToday();

        if (dateFilter === 'today' && argDateStr !== todayStr) return false;
        if (dateFilter === '7days' && argDateStr < getArgentinaDaysAgo(7)) return false;
        if (dateFilter === '30days' && argDateStr < getArgentinaDaysAgo(30)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'stock_high') {
        return getProductStock(b, activeLocation) - getProductStock(a, activeLocation);
      }
      if (sortBy === 'stock_low') {
        return getProductStock(a, activeLocation) - getProductStock(b, activeLocation);
      }
      if (sortBy === 'recent') {
        const dateA = new Date(a.lastPurchaseDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.lastPurchaseDate || b.createdAt || 0).getTime();
        return dateB - dateA;
      }
      return 0;
    });
  }, [products, activeLocation, stockLevelFilter, selectedProvider, selectedCategory, dateFilter, sortBy]);

  // Unique categories list
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto animate-fadeIn">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
            <Boxes className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Gestión de Stock
              </h1>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3 h-3 text-emerald-600" />
                Sucursal: {getLocationName(activeLocation)}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium -mt-0.5">
              Centro operativo de inventario, ajustes y transferencias
            </p>
          </div>
        </div>

        {/* History Shortcuts */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowPurchaseHistory(true)}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Ver historial de ingresos"
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Historial</span> Compras
          </button>

          <button
            onClick={() => setShowTransferHistory(true)}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Ver historial de transferencias"
          >
            <History className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Historial</span> Transf.
          </button>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS: Productos | Ingresar mercadería | Transferencias */}
      <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
        <button
          onClick={() => {
            setSubTab('products');
            setIsCameraActive(false);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            subTab === 'products'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Productos</span>
        </button>

        <button
          onClick={() => {
            setSubTab('purchase');
            setIsCameraActive(false);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            subTab === 'purchase'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Ingresar mercadería</span>
        </button>

        <button
          onClick={() => {
            setSubTab('transfers');
            setIsCameraActive(false);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            subTab === 'transfers'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Transferencias</span>
        </button>
      </div>

      {/* 3. TAB 1: PRODUCTOS (OPERATIONAL CENTER & SEARCH) */}
      {subTab === 'products' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 3.1 HERO SEARCH & SCANNER BAR */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3 relative">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Buscar o escanear producto (EAN, nombre, marca o presentación)
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setExternalNotFound(null);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Escribí al menos 2 letras o pasá el lector USB..."
                  className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-semibold text-slate-900 outline-none transition-all shadow-inner placeholder:text-slate-400"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Escanear con cámara button */}
              <button
                type="button"
                onClick={() => setIsCameraActive((prev) => !prev)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                  isCameraActive
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                }`}
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">
                  {isCameraActive ? 'Cerrar cámara' : 'Escanear con cámara'}
                </span>
                <span className="sm:hidden">Cámara</span>
              </button>
            </div>

            {/* Collapsible Camera Scanner View */}
            {isCameraActive && (
              <div className="pt-2 animate-fadeIn">
                <div className="rounded-2xl overflow-hidden border border-slate-200">
                  <BarcodeScanner
                    onScan={handleBarcodeScanned}
                    isScanning={isCameraActive}
                  />
                </div>
              </div>
            )}

            {/* Live Search Suggestions Dropdown */}
            {searchQuery.trim().length >= 2 && searchMatches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-20 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto animate-fadeIn">
                {searchMatches.map((p) => {
                  const aimogastaStock = getStockForLocation(p, 'aimogasta');
                  const olascoagaStock = getStockForLocation(p, 'olascoaga');

                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="w-full p-3 text-left hover:bg-emerald-50/70 transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900 group-hover:text-emerald-800 truncate">
                            {p.name}
                          </span>
                          {p.brand && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded uppercase">
                              {p.brand}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                          <span>EAN: {p.barcode}</span>
                          {p.presentation && <span>• {p.presentation}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right text-xs">
                          <span className="font-extrabold text-slate-700 block">
                            Aim: {aimogastaStock} | Olas: {olascoagaStock}
                          </span>
                          <span className="text-[10px] text-slate-400">Total: {getTotalStock(p)} un.</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          Seleccionar
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* External Not Found Banner with quick create */}
            {externalNotFound && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5 text-xs text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Código EAN no encontrado: {externalNotFound}</span>
                    <p className="text-amber-700 text-[11px]">¿Deseas registrar este producto en el catálogo?</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowManualCreateModal(true)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Crear Nuevo Producto</span>
                </button>
              </div>
            )}
          </div>

          {/* 3.2 SELECTED PRODUCT OPERATIONAL CARD */}
          {activeProduct && (
            <div className="p-5 bg-white border-2 border-emerald-500/80 rounded-3xl shadow-lg space-y-4 animate-fadeIn">
              {/* Product Header & Info */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {activeProduct.category || 'General'}
                    </span>
                    {activeProduct.brand && (
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                        {activeProduct.brand}
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg font-black text-slate-900 leading-snug">
                    {activeProduct.name}
                  </h2>

                  {activeProduct.presentation && (
                    <p className="text-xs text-slate-500 font-medium">{activeProduct.presentation}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 pt-0.5">
                    <Barcode className="w-4 h-4 text-slate-400" />
                    <span className="font-bold tracking-wider">{activeProduct.barcode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => setShowDetailModal(true)}
                    className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 text-xs font-bold flex items-center gap-1"
                    title="Ver ficha técnica completa"
                  >
                    <Eye className="w-4 h-4 text-slate-600" />
                    <span>Ver Detalle</span>
                  </button>

                  <button
                    onClick={handleScanNext}
                    className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                    title="Cerrar selección"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stock Badges per Branch & Financials */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                {/* Aimogasta */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Stock Aimogasta
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-700">
                    {getStockForLocation(activeProduct, 'aimogasta')}
                  </span>
                </div>

                {/* Olascoaga */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Stock Olascoaga
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-700">
                    {getStockForLocation(activeProduct, 'olascoaga')}
                  </span>
                </div>

                {/* Total */}
                <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider block">
                    Stock Total
                  </span>
                  <span className="text-xl font-black font-mono">
                    {getTotalStock(activeProduct)}
                  </span>
                </div>

                {/* Precio Venta */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Precio Venta
                  </span>
                  <span className="text-sm font-black font-mono text-blue-700">
                    {activeProduct.salePrice ? `$${activeProduct.salePrice.toLocaleString('es-AR')}` : '-'}
                  </span>
                </div>

                {/* Último Costo */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Último Costo
                  </span>
                  <span className="text-sm font-black font-mono text-slate-700">
                    {activeProduct.currentCost || activeProduct.lastCost || activeProduct.costPrice
                      ? `$${(activeProduct.currentCost || activeProduct.lastCost || activeProduct.costPrice || 0).toLocaleString('es-AR')}`
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: + INGRESAR | − RETIRAR | = ESTABLECER | TRANSFERIR */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setActiveAdjustOperation('add');
                    setAdjustSuccessMsg(null);
                  }}
                  className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    activeAdjustOperation === 'add'
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ INGRESAR</span>
                </button>

                <button
                  onClick={() => {
                    setActiveAdjustOperation('subtract');
                    setAdjustSuccessMsg(null);
                  }}
                  className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    activeAdjustOperation === 'subtract'
                      ? 'bg-rose-700 text-white shadow-md'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                  <span>− RETIRAR</span>
                </button>

                <button
                  onClick={() => {
                    setActiveAdjustOperation('set');
                    setAdjustSuccessMsg(null);
                  }}
                  className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    activeAdjustOperation === 'set'
                      ? 'bg-indigo-700 text-white shadow-md'
                      : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                >
                  <Equal className="w-4 h-4 stroke-[2.5]" />
                  <span>= ESTABLECER</span>
                </button>

                <button
                  onClick={() => setShowTransferModal(true)}
                  className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                  <span>TRANSFERIR</span>
                </button>
              </div>

              {/* Success Notification Banner with Scan Next Button */}
              {adjustSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{adjustSuccessMsg}</span>
                  </div>
                  <button
                    onClick={handleScanNext}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-colors shadow-xs"
                  >
                    Escanear siguiente →
                  </button>
                </div>
              )}

              {/* Inline StockManager for seamless adjustment without navigating away */}
              {activeAdjustOperation && (
                <div className="pt-2 border-t border-slate-100 animate-fadeIn">
                  <StockManager
                    product={activeProduct}
                    initialOperation={activeAdjustOperation}
                    onStockUpdated={handleStockUpdated}
                    onScanNext={handleScanNext}
                  />
                </div>
              )}
            </div>
          )}

          {/* 3.3 FILTERS & CATALOG SECTION */}
          <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Catálogo de Productos</h3>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {filteredProducts.length} productos
                </span>
              </div>

              <button
                onClick={() => setShowManualCreateModal(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ Crear Producto Manual</span>
              </button>
            </div>

            {/* Filter Controls Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* Stock level filter (strictly for active location) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Stock en {getLocationName(activeLocation)}
                </label>
                <select
                  value={stockLevelFilter}
                  onChange={(e) => setStockLevelFilter(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                >
                  <option value="all">Todos los niveles</option>
                  <option value="zero">Sin stock (0 un.)</option>
                  <option value="low">Stock bajo (1 a 5 un.)</option>
                  <option value="available">Con stock (&gt; 0 un.)</option>
                </select>
              </div>

              {/* Category filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                >
                  <option value="all">Todas las categorías</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Proveedor
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                >
                  <option value="all">Todos los proveedores</option>
                  {providersList.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sorting */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Ordenar por
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                >
                  <option value="name">Nombre (A - Z)</option>
                  <option value="stock_high">Mayor stock ({getLocationName(activeLocation)})</option>
                  <option value="stock_low">Menor stock ({getLocationName(activeLocation)})</option>
                  <option value="recent">Recientes</option>
                </select>
              </div>
            </div>

            {/* Products Catalog Cards Grid */}
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No se encontraron productos con estos filtros</p>
                <p className="text-xs text-slate-400">Probá modificando los criterios de búsqueda o nivel de stock.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {filteredProducts.map((product) => {
                  const isSelected = activeProduct?.id === product.id;

                  return (
                    <div
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className={`cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-emerald-500 rounded-[20px] scale-[1.01]' : ''
                      }`}
                    >
                      <ProductCard
                        product={product}
                        showActions={true}
                        onEdit={(e) => {
                          e.stopPropagation();
                          setEditingProduct(product);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: INGRESAR MERCADERÍA (PURCHASE ENTRY) */}
      {subTab === 'purchase' && (
        <div className="space-y-4 animate-fadeIn">
          <PurchaseEntry
            products={products}
            onProductsUpdated={onProductsUpdated}
            onComplete={() => {
              setSubTab('products');
            }}
          />
        </div>
      )}

      {/* 5. TAB 3: TRANSFERENCIAS (INTER-BRANCH TRANSFERS) */}
      {subTab === 'transfers' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl">
                  <ArrowLeftRight className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Transferencias entre Sucursales</h3>
                  <p className="text-xs text-slate-500">Mover stock de Aimogasta a Olascoaga o viceversa con validación atómica</p>
                </div>
              </div>

              <button
                onClick={() => setShowTransferModal(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Transferencia</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800">
                ¿Cómo funcionan las transferencias?
              </p>
              <p>
                Permiten descontar stock de la sucursal de origen e incrementarlo en la sucursal de destino en una única transacción segura. Ambas sucursales actualizarán su disponibilidad de manera inmediata.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTransferHistory(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <History className="w-4 h-4 text-emerald-600" />
                <span>Ver Historial de Transferencias Realizadas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <StockTransferModal
          products={products}
          onClose={() => setShowTransferModal(false)}
          onTransferSuccess={(updatedProducts) => {
            onProductsUpdated(updatedProducts);
            setShowTransferModal(false);
          }}
          initialProductId={activeProduct?.id}
        />
      )}

      {/* MODAL: PRODUCT DETAIL MODAL */}
      {showDetailModal && activeProduct && (
        <ProductDetailModal
          product={activeProduct}
          onClose={() => setShowDetailModal(false)}
          onEditProduct={(p) => setEditingProduct(p)}
        />
      )}

      {/* MODAL: EDIT PRODUCT FORM */}
      {editingProduct && (
        <ProductForm
          initialProduct={editingProduct}
          onSave={(saved) => {
            onProductSaved(saved);
            setEditingProduct(null);
          }}
          onCancel={() => setEditingProduct(null)}
        />
      )}

      {/* MODAL: CREATE MANUAL PRODUCT FORM */}
      {showManualCreateModal && (
        <ProductForm
          onSave={(saved) => {
            onProductSaved(saved);
            setShowManualCreateModal(false);
            handleSelectProduct(saved);
          }}
          onCancel={() => setShowManualCreateModal(false)}
        />
      )}

      {/* MODAL: PURCHASE HISTORY */}
      {showPurchaseHistory && (
        <PurchaseHistoryModal
          onClose={() => setShowPurchaseHistory(false)}
          onSelectPurchase={(id) => setSelectedPurchaseIdForDetail(id)}
        />
      )}

      {/* MODAL: TRANSFER HISTORY */}
      {showTransferHistory && (
        <TransferHistoryModal
          onClose={() => setShowTransferHistory(false)}
          onSelectTransfer={(record) => setSelectedTransferForDetail(record)}
        />
      )}

      {/* MODAL: PURCHASE DETAIL */}
      {selectedPurchaseIdForDetail && (
        <PurchaseDetailModal
          purchaseId={selectedPurchaseIdForDetail}
          onClose={() => setSelectedPurchaseIdForDetail(null)}
        />
      )}

      {/* MODAL: TRANSFER DETAIL */}
      {selectedTransferForDetail && (
        <StockTransferDetailModal
          transfer={selectedTransferForDetail}
          onClose={() => setSelectedTransferForDetail(null)}
        />
      )}
    </div>
  );
};
