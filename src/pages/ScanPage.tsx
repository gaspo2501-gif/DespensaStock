import React, { useState, useCallback } from 'react';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { ProductCard } from '../components/product/ProductCard';
import { ProductForm } from '../components/product/ProductForm';
import { StockManager } from '../components/product/StockManager';
import { PurchaseEntry } from '../components/stock/PurchaseEntry';
import { productService } from '../services/firebase/productService';
import { getProductByBarcodeExternal } from '../services/externalApi/productApiService';
import { Product, CreateProductInput } from '../types/product';
import { 
  ScanLine, 
  Database, 
  Globe, 
  PlusCircle, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Edit3, 
  ArrowLeft,
  Barcode,
  Truck,
  Box
} from 'lucide-react';
import { playScanSound } from '../utils/audio';

interface ScanPageProps {
  products?: Product[];
  onProductsUpdated?: (updatedProducts: Product[]) => void;
  onProductSaved: (product: Product) => void;
  onBackToHome: () => void;
}

type StockMode = 'single' | 'purchase';

type ScanStage = 
  | 'scanning'
  | 'searching_firebase'
  | 'found_firebase'
  | 'searching_external'
  | 'found_external'
  | 'not_found'
  | 'manual_form';

export const ScanPage: React.FC<ScanPageProps> = ({
  products = [],
  onProductsUpdated = () => {},
  onProductSaved,
  onBackToHome,
}) => {
  const [stockMode, setStockMode] = useState<StockMode>('single');
  const [stage, setStage] = useState<ScanStage>('scanning');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  
  // Results states
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

  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    setScannedBarcode(barcode);
    setErrorMessage(null);

    // 1. First priority: Check Firebase database
    setStage('searching_firebase');

    try {
      const localMatch = await productService.getByBarcode(barcode);

      if (localMatch) {
        // Found in Firebase!
        setFoundProduct(localMatch);
        setStage('found_firebase');
        playScanSound('found');
        return;
      }
    } catch (err) {
      console.warn('Firebase lookup failed, proceeding to external API:', err);
    }

    // 2. Second priority: Query external product API
    setStage('searching_external');

    try {
      const externalResult = await getProductByBarcodeExternal(barcode);

      if (externalResult.found && externalResult.product) {
        // Found in External API!
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
      console.warn('External API lookup failed:', err);
    }

    // 3. Third priority: Not found anywhere -> Open Manual Form
    playScanSound('error');
    setStage('not_found');
  }, []);

  // Save external product directly into Firebase
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

  // Save manual form submission
  const handleManualFormSubmit = async (inputData: CreateProductInput) => {
    const saved = await productService.saveProduct(inputData);
    setFoundProduct(saved);
    onProductSaved(saved);
    setStage('found_firebase');
    playScanSound('success');
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn max-w-xl mx-auto">
      {/* Top Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-full transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Inicio
        </button>

        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-emerald-600" />
          Gestión de Stock
        </h2>

        {stockMode === 'single' && stage !== 'scanning' ? (
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

      {/* Mode Switcher Tabs */}
      <div className="bg-slate-200 p-1 rounded-2xl flex gap-1 text-xs font-bold">
        <button
          onClick={() => setStockMode('single')}
          className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            stockMode === 'single'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Box className="w-4 h-4 text-emerald-600" />
          Carga Individual
        </button>

        <button
          onClick={() => setStockMode('purchase')}
          className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            stockMode === 'purchase'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Truck className="w-4 h-4 text-indigo-600" />
          Ingreso de Mercadería
        </button>
      </div>

      {/* RENDER MODE B: NUEVO INGRESO DE MERCADERÍA */}
      {stockMode === 'purchase' ? (
        <PurchaseEntry
          products={products}
          onProductsUpdated={onProductsUpdated}
          onBackToHome={onBackToHome}
        />
      ) : (
        /* RENDER MODE A: CARGA INDIVIDUAL / AJUSTE DE STOCK (EXISTING SCAN WORKFLOW) */
        <>
          {/* 1. SCANNING ACTIVE STAGE */}
      {stage === 'scanning' && (
        <div className="space-y-4">
          <BarcodeScanner
            onScanSuccess={handleBarcodeScanned}
            isScanningActive={true}
          />

          <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs space-y-1">
            <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Prioridad de Búsqueda Garantizada
            </h4>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              1. Base de datos propia de Firebase → 2. API externa de productos → 3. Formulario de carga manual.
            </p>
          </div>
        </div>
      )}

      {/* 2. SEARCHING IN FIREBASE STAGE */}
      {stage === 'searching_firebase' && (
        <div className="p-8 bg-white border border-slate-200 rounded-3xl shadow-lg text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto animate-pulse">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-wider">Código: {scannedBarcode}</span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">Buscando en tu Base de Datos...</h3>
            <p className="text-xs text-slate-500 mt-1">Verificando si el producto ya está registrado en Firebase</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-600 h-full w-2/3 animate-[pulse_1s_infinite]"></div>
          </div>
        </div>
      )}

      {/* 3. FOUND IN FIREBASE STAGE */}
      {stage === 'found_firebase' && foundProduct && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-600 text-white rounded-2xl flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-100">¡Producto Encontrado!</p>
                <p className="text-sm font-bold">Registrado en tu base propia</p>
              </div>
            </div>

            <button
              onClick={resetScan}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
            >
              <ScanLine className="w-3.5 h-3.5" />
              Escanear
            </button>
          </div>

          <ProductCard product={foundProduct} showActions={false} />

          {/* Interactive Stock Manager */}
          <StockManager
            product={foundProduct}
            onStockUpdated={(updated) => {
              setFoundProduct(updated);
              onProductSaved(updated);
            }}
            onScanNext={resetScan}
          />

          <button
            onClick={resetScan}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <ScanLine className="w-4 h-4 text-emerald-400" />
            Escanear Otro Producto
          </button>
        </div>
      )}

      {/* 4. SEARCHING IN EXTERNAL API STAGE */}
      {stage === 'searching_external' && (
        <div className="p-8 bg-white border border-slate-200 rounded-3xl shadow-lg text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto animate-pulse">
            <Globe className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wider">Código: {scannedBarcode}</span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">Consultando API Externa...</h3>
            <p className="text-xs text-slate-500 mt-1">No estaba en tu base. Buscando en catálogo comercial público...</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-600 h-full w-3/4 animate-[pulse_1s_infinite]"></div>
          </div>
        </div>
      )}

      {/* 5. FOUND IN EXTERNAL API STAGE */}
      {stage === 'found_external' && externalProduct && (
        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-xl space-y-5">
          <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-semibold flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div>
              <p className="font-bold">Producto encontrado en API externa</p>
              <p className="text-[11px] text-indigo-700">Puedes confirmarlo para guardarlo en tu catálogo de Firebase.</p>
            </div>
          </div>

          {/* External Product Card Preview */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-start gap-3">
              {externalProduct.imageUrl ? (
                <img
                  src={externalProduct.imageUrl}
                  alt={externalProduct.name}
                  className="w-16 h-16 object-contain bg-white rounded-xl border p-1"
                />
              ) : (
                <div className="w-16 h-16 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400">
                  <Barcode className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1">
                <span className="text-[11px] font-bold text-indigo-600 uppercase">{externalProduct.brand || 'Sin Marca'}</span>
                <h4 className="text-sm font-bold text-slate-900">{externalProduct.name}</h4>
                <p className="text-xs text-slate-500">{externalProduct.presentation} • {externalProduct.category}</p>
                <p className="text-xs font-mono font-bold text-slate-700 mt-1">EAN: {externalProduct.barcode}</p>
              </div>
            </div>
          </div>

          {/* Initial Stock Input for External Product */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
            <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Cantidad Inicial de Stock Físico</span>
              <span className="text-[10px] text-emerald-700 font-normal">Inventario</span>
            </label>
            <input
              type="number"
              min="0"
              value={externalInitialStock}
              onChange={(e) => setExternalInitialStock(parseInt(e.target.value, 10) || 0)}
              className="w-full px-4 py-2.5 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-slate-900 text-base focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {errorMessage && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl">{errorMessage}</p>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleSaveExternalProduct}
              disabled={isSavingExternal}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingExternal ? 'Guardando en Firebase...' : 'Confirmar y Guardar en tu Base'}
            </button>

            <button
              onClick={() => setStage('manual_form')}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Editar datos antes de guardar
            </button>
          </div>
        </div>
      )}

      {/* 6. NOT FOUND ANYWHERE STAGE */}
      {stage === 'not_found' && (
        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-mono font-bold text-slate-500">Código: {scannedBarcode}</span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">Producto no encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              El código de barras no está en tu base propia ni en bases externas públicas.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={() => setStage('manual_form')}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Cargar Información Manualmente
            </button>

            <button
              onClick={resetScan}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-2xl transition-colors"
            >
              Intentar Escanear Otro
            </button>
          </div>
        </div>
      )}

      {/* 7. MANUAL FORM STAGE */}
      {stage === 'manual_form' && (
        <ProductForm
          initialBarcode={scannedBarcode}
          initialData={externalProduct || undefined}
          source={externalProduct ? 'external_api' : 'manual'}
          onSubmit={handleManualFormSubmit}
          onCancel={resetScan}
        />
      )}
        </>
      )}
    </div>
  );
};
