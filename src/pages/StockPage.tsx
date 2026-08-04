import React, { useState } from 'react';
import { Product, CreateProductInput } from '../types/product';
import { PurchaseEntry } from '../components/stock/PurchaseEntry';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { ProductCard } from '../components/product/ProductCard';
import { ProductForm } from '../components/product/ProductForm';
import { StockManager } from '../components/product/StockManager';
import { productService } from '../services/firebase/productService';
import { getProductByBarcodeExternal } from '../services/externalApi/productApiService';
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
  Edit3
} from 'lucide-react';

interface StockPageProps {
  products: Product[];
  onProductsUpdated: (updatedProducts: Product[]) => void;
  onProductSaved: (product: Product) => void;
  onBackToHome: () => void;
  initialMode?: 'single' | 'purchase';
}

type StockSubMode = 'single' | 'purchase';

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
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [externalProduct, setExternalProduct] = useState<CreateProductInput | null>(null);
  const [externalInitialStock, setExternalInitialStock] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingExternal, setIsSavingExternal] = useState(false);

  const resetScan = () => {
    setStage('scanning');
    setScannedBarcode('');
    setFoundProduct(null);
    setExternalProduct(null);
    setExternalInitialStock(1);
    setErrorMessage(null);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setScannedBarcode(barcode);
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

  return (
    <div className="space-y-6 pb-20 animate-fadeIn max-w-2xl mx-auto">
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
            Escanear
          </button>
        ) : (
          <div className="w-16"></div>
        )}
      </div>

      {/* Main Mode Selection Header Tabs */}
      <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm space-y-2">
        <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-2 pt-1">
          Seleccionar Operación de Stock
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => setSubMode('single')}
            className={`p-3.5 rounded-2xl border transition-all text-left flex items-start gap-3 ${
              subMode === 'single'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/80'
                : 'bg-slate-50 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${
              subMode === 'single' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">1. CARGA INDIVIDUAL</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Ajuste directo de stock por escaneo (sumar, restar o establecer stock).
              </p>
            </div>
          </button>

          <button
            onClick={() => setSubMode('purchase')}
            className={`p-3.5 rounded-2xl border transition-all text-left flex items-start gap-3 ${
              subMode === 'purchase'
                ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/80'
                : 'bg-slate-50 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${
              subMode === 'purchase' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">2. NUEVO INGRESO DE MERCADERÍA</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Recepción por proveedor, actualización de costos y precio de venta.
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

      {/* MODE 1: CARGA INDIVIDUAL / AJUSTE DE STOCK */}
      {subMode === 'single' && (
        <div className="space-y-4">
          {/* 1. SCANNING STAGE */}
          {stage === 'scanning' && (
            <div className="space-y-4">
              <BarcodeScanner
                onScanSuccess={handleBarcodeScanned}
                isScanningActive={stage === 'scanning'}
              />

              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm text-center">
                <p className="text-xs font-semibold text-slate-600">
                  Apunta la cámara al código de barras del producto.
                </p>
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
                <input
                  type="number"
                  min="0"
                  value={externalInitialStock}
                  onChange={(e) => setExternalInitialStock(parseInt(e.target.value, 10) || 0)}
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
    </div>
  );
};
