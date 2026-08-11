import React, { useState, useCallback } from 'react';
import { Product, CreateProductInput } from '../../types/product';
import { Provider } from '../../types/provider';
import { ProcessPurchaseItemInput, Purchase } from '../../types/purchase';
import { calculateSuggestedSalePrice } from '../../utils/pricing';
import { productService } from '../../services/firebase/productService';
import { purchaseService } from '../../services/firebase/purchaseService';
import { providerService } from '../../services/firebase/providerService';
import { ProviderModal } from '../provider/ProviderModal';
import { BarcodeScanner } from '../scanner/BarcodeScanner';
import { ProductForm } from '../product/ProductForm';
import { NumericInput } from '../common/NumericInput';
import { playScanSound } from '../../utils/audio';
import { useLocation } from '../../context/LocationContext';
import { getLocationName } from '../../types/location';
import { 
  Truck, 
  ScanLine, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  ArrowRight, 
  Save, 
  X, 
  ShoppingBag, 
  RotateCcw,
  Loader2,
  DollarSign,
  Package,
  Barcode,
  Building2
} from 'lucide-react';

interface PurchaseEntryProps {
  products: Product[];
  onProductsUpdated: (updatedProducts: Product[]) => void;
  onBackToHome: () => void;
}

export const PurchaseEntry: React.FC<PurchaseEntryProps> = ({
  products,
  onProductsUpdated,
  onBackToHome,
}) => {
  const { activeLocation } = useLocation();

  // Provider state
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showProviderModal, setShowProviderModal] = useState<boolean>(false);

  // Draft purchase items state
  const [draftItems, setDraftItems] = useState<ProcessPurchaseItemInput[]>([]);

  // Scanner modal state
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);

  // Item add modal / inline state
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingQty, setPendingQty] = useState<number>(1);
  const [pendingCost, setPendingCost] = useState<number>(0);
  const [pendingFinalSalePrice, setPendingFinalSalePrice] = useState<number>(0);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New product inline creation form state
  const [showNewProductForm, setShowNewProductForm] = useState<boolean>(false);

  // Manual search term
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Execution states
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedPurchase, setCompletedPurchase] = useState<Purchase | null>(null);

  // Calculate suggested sale price dynamically
  const pendingSuggestedSalePrice = calculateSuggestedSalePrice(pendingCost);

  // Open item add modal for a selected product
  const handleSelectProductForAddition = (prod: Product) => {
    setPendingProduct(prod);
    setPendingQty(1);
    const lastCostVal = prod.currentCost ?? prod.lastCost ?? prod.costPrice ?? 0;
    setPendingCost(lastCostVal);

    const prevCost = lastCostVal;
    const suggested = calculateSuggestedSalePrice(lastCostVal);
    const currentPrice = prod.salePrice ?? 0;

    // If cost increased, or current sale price is 0, default to suggested
    if (lastCostVal > prevCost || currentPrice === 0) {
      setPendingFinalSalePrice(suggested);
    } else {
      setPendingFinalSalePrice(currentPrice > 0 ? currentPrice : suggested);
    }

    setShowAddModal(true);
  };

  // Handle barcode scanned from scanner or typed manually
  const handleBarcodeScanned = async (barcode: string) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;

    setScannedBarcode(cleanBarcode);
    playScanSound('found');

    // Check in local catalog first
    const match = products.find(p => p.barcode === cleanBarcode) || await productService.getByBarcode(cleanBarcode);

    if (match) {
      handleSelectProductForAddition(match);
      setShowScannerModal(false);
    } else {
      // Product not registered
      playScanSound('error');
      setShowScannerModal(false);
      setShowNewProductForm(true);
    }
  };

  // Add item to draft batch
  const handleConfirmAddItem = () => {
    if (!pendingProduct) return;
    if (pendingQty <= 0) {
      setErrorMsg('La cantidad debe ser mayor a cero');
      return;
    }
    if (pendingCost < 0) {
      setErrorMsg('El costo no puede ser negativo');
      return;
    }

    const prevCost = pendingProduct.currentCost ?? pendingProduct.lastCost ?? pendingProduct.costPrice ?? 0;
    const prevSalePrice = pendingProduct.salePrice ?? 0;

    // Check for duplicate in draft batch
    setDraftItems((prev) => {
      const idx = prev.findIndex((item) => item.product.id === pendingProduct.id);
      if (idx !== -1) {
        // Aggregate quantity!
        const existing = prev[idx];
        const newQty = existing.quantity + pendingQty;
        const updatedItem: ProcessPurchaseItemInput = {
          ...existing,
          quantity: newQty,
          unitCost: pendingCost,
          suggestedSalePrice: pendingSuggestedSalePrice,
          finalSalePrice: pendingFinalSalePrice,
        };
        const copy = [...prev];
        copy[idx] = updatedItem;
        return copy;
      } else {
        return [
          ...prev,
          {
            product: pendingProduct,
            quantity: pendingQty,
            unitCost: pendingCost,
            suggestedSalePrice: pendingSuggestedSalePrice,
            finalSalePrice: pendingFinalSalePrice,
            previousCost: prevCost,
            previousSalePrice: prevSalePrice,
          },
        ];
      }
    });

    // Reset pending state
    setShowAddModal(false);
    setPendingProduct(null);
    setSearchTerm('');
  };

  // Save brand new product from form during purchase entry
  const handleSaveNewProduct = async (inputData: CreateProductInput) => {
    // Save new product in catalog with initial stock = 0
    const created = await productService.saveProduct({
      ...inputData,
      stockQuantity: 0,
    });

    onProductsUpdated([created]);
    setShowNewProductForm(false);
    // Immediately open addition modal for this newly created product
    handleSelectProductForAddition(created);
  };

  // Remove item from draft batch
  const handleRemoveDraftItem = (productId: string) => {
    setDraftItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // Update draft item quantity
  const handleUpdateItemQty = (productId: string, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) return;
    setDraftItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i))
    );
  };

  // Update draft item unit cost
  const handleUpdateItemCost = (productId: string, newCost: number) => {
    if (isNaN(newCost) || newCost < 0) return;
    setDraftItems((prev) =>
      prev.map((i) => {
        if (i.product.id === productId) {
          const suggested = calculateSuggestedSalePrice(newCost);
          // If cost increased over previous cost, auto update final sale price to suggested
          const prevCost = i.previousCost ?? 0;
          const shouldAutoUpdatePrice = newCost > prevCost || i.previousSalePrice === 0;
          return {
            ...i,
            unitCost: newCost,
            suggestedSalePrice: suggested,
            finalSalePrice: shouldAutoUpdatePrice ? suggested : (i.finalSalePrice || suggested),
          };
        }
        return i;
      })
    );
  };

  // Update draft item final sale price
  const handleUpdateItemSalePrice = (productId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    setDraftItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, finalSalePrice: newPrice } : i))
    );
  };

  // Totals calculations
  const totalAmount = draftItems.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
  const totalUnitsCount = draftItems.reduce((acc, i) => acc + i.quantity, 0);

  // Confirm complete purchase
  const handleConfirmPurchase = async () => {
    if (!selectedProvider) {
      setErrorMsg('Debes seleccionar un proveedor para registrar el ingreso');
      setShowProviderModal(true);
      return;
    }

    if (draftItems.length === 0) {
      setErrorMsg('Debes agregar al menos un producto al ingreso');
      return;
    }

    setIsConfirming(true);
    setErrorMsg(null);

    try {
      const result = await purchaseService.processPurchase({
        providerId: selectedProvider.id,
        providerName: selectedProvider.name,
        items: draftItems,
        locationId: activeLocation,
      });

      playScanSound('success');
      onProductsUpdated(result.updatedProducts);
      setCompletedPurchase(result.purchase);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar el ingreso de mercadería');
    } finally {
      setIsConfirming(false);
    }
  };

  // Reset entire entry
  const handleResetPurchase = () => {
    setDraftItems([]);
    setCompletedPurchase(null);
    setErrorMsg(null);
  };

  // Search filtered products for quick selection
  const searchResults = searchTerm.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.barcode.includes(searchTerm.trim())
      ).slice(0, 5)
    : [];

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto animate-fadeIn">
      {/* 1. PROVIDER SELECTION BAR */}
      <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Proveedor</p>
              <h3 className="text-base font-extrabold text-slate-900">
                {selectedProvider ? selectedProvider.name : 'Sin Seleccionar'}
              </h3>
            </div>
          </div>

          <button
            onClick={() => setShowProviderModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4" />
            {selectedProvider ? 'Cambiar' : 'Seleccionar'}
          </button>
        </div>

        {selectedProvider && selectedProvider.phone && (
          <p className="text-xs text-slate-500 pl-1">
            📞 Tel: <span className="font-semibold text-slate-700">{selectedProvider.phone}</span>
            {selectedProvider.notes && ` • ${selectedProvider.notes}`}
          </p>
        )}
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 font-bold px-2 py-0.5">✕</button>
        </div>
      )}

      {/* 2. ADD PRODUCTS SECTION */}
      {!completedPurchase && (
        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-4">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            Agregar Productos al Ingreso
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setShowScannerModal(true)}
              className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ScanLine className="w-4 h-4" />
              Escanear Código de Barras
            </button>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Quick Search Results Dropdown */}
          {searchTerm.trim() && (
            <div className="border border-slate-200 bg-slate-50 rounded-2xl p-2 space-y-1.5 max-h-60 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-3 text-center space-y-2">
                  <p className="text-xs text-slate-500">No se encontró en tu catálogo</p>
                  <button
                    onClick={() => {
                      setScannedBarcode(searchTerm.trim());
                      setShowNewProductForm(true);
                      setSearchTerm('');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Crear Producto Nuevo
                  </button>
                </div>
              ) : (
                searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProductForAddition(p)}
                    className="w-full p-2.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl text-left transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">{p.name}</h5>
                      <p className="text-[11px] text-slate-500">{p.brand} • {p.presentation} • EAN: {p.barcode}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      + Agregar
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. DRAFT BATCH ITEMS LIST */}
      {!completedPurchase && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-bold">Listado de Mercadería a Ingresar</h4>
            </div>
            <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
              {draftItems.length} {draftItems.length === 1 ? 'Producto' : 'Productos'}
            </span>
          </div>

          {draftItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Package className="w-10 h-10 stroke-1 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-500">Aún no has agregado productos a este ingreso.</p>
              <p className="text-[11px] text-slate-400">Usa el escáner o el buscador para agregar items.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3 divide-y divide-slate-100">
              {draftItems.map((item) => {
                const itemSubtotal = item.quantity * item.unitCost;
                const costIncreased = item.previousCost !== undefined && item.unitCost > item.previousCost;

                return (
                  <div key={item.product.id} className="pt-3 first:pt-0 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                          {item.product.brand || 'Sin Marca'}
                        </span>
                        <h5 className="text-sm font-bold text-slate-900">{item.product.name}</h5>
                        <p className="text-xs text-slate-500 font-mono">
                          EAN: {item.product.barcode} {item.product.presentation && `• ${item.product.presentation}`}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRemoveDraftItem(item.product.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Quitar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Inputs Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
                      {/* Quantity Input */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cantidad</label>
                        <div className="flex items-center gap-1">
                          <NumericInput
                            min="1"
                            allowDecimal={false}
                            value={item.quantity}
                            onChangeValue={(val) => handleUpdateItemQty(item.product.id, val)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Unit Cost Input */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Costo Unit. ($)</label>
                        <NumericInput
                          min="0"
                          step="any"
                          allowDecimal={true}
                          value={item.unitCost}
                          onChangeValue={(val) => handleUpdateItemCost(item.product.id, val)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Final Sale Price Input */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Precio Venta ($)</label>
                        <NumericInput
                          min="0"
                          step="any"
                          allowDecimal={true}
                          value={item.finalSalePrice}
                          onChangeValue={(val) => handleUpdateItemSalePrice(item.product.id, val)}
                          className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-emerald-900 font-mono font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Subtotal Display */}
                      <div className="flex flex-col justify-center text-right pr-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Subtotal</span>
                        <span className="text-sm font-mono font-bold text-slate-900">
                          ${itemSubtotal.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>

                    {/* Cost Increase Warning Banner */}
                    {costIncreased && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-semibold text-amber-900 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>
                            Costo aumentó: ${item.previousCost} ➔ ${item.unitCost}. Precio sugerido actualizado: ${item.suggestedSalePrice}.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TOTALS & ACTIONS SUMMARY */}
          {draftItems.length > 0 && (
            <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-4">
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Cantidad Total de Unidades:</span>
                  <span className="font-mono font-bold text-white">{totalUnitsCount} un.</span>
                </div>
                <div className="flex items-center justify-between text-base font-extrabold pt-1 border-t border-slate-800">
                  <span className="text-emerald-400">Monto Total del Ingreso:</span>
                  <span className="font-mono text-xl text-emerald-400">${totalAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleResetPurchase}
                  className="w-1/3 py-3 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-2xl transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-4 h-4" /> Cancelar
                </button>

                <button
                  onClick={handleConfirmPurchase}
                  disabled={isConfirming || !selectedProvider}
                  className="w-2/3 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isConfirming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Confirmar Ingreso
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. COMPLETED PURCHASE RECEIPT */}
      {completedPurchase && (
        <div className="p-6 bg-white border border-emerald-200 rounded-3xl shadow-xl text-center space-y-5 animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-100 border border-emerald-300 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider">¡Ingreso Registrado Con Éxito!</span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1">
              Proveedor: {completedPurchase.providerName}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Se han sumado las unidades al stock y actualizado los precios en tu catálogo.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
            <div className="flex justify-between font-semibold text-slate-700">
              <span>Total Unidades Ingresadas:</span>
              <span className="font-mono text-slate-900">{completedPurchase.totalItemsCount} un.</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-700">
              <span>Monto Total Invertido:</span>
              <span className="font-mono text-emerald-700 font-bold">${completedPurchase.totalAmount.toLocaleString('es-AR')}</span>
            </div>
            <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200">
              <span>Fecha y Hora:</span>
              <span>{new Date(completedPurchase.createdAt).toLocaleString('es-AR')}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleResetPurchase}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-lg transition-all"
            >
              Registrar Otro Ingreso
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: PROVIDER SELECTOR */}
      {showProviderModal && (
        <ProviderModal
          selectedProviderId={selectedProvider?.id}
          onSelectProvider={(prov) => {
            setSelectedProvider(prov);
            setErrorMsg(null);
          }}
          onClose={() => setShowProviderModal(false)}
        />
      )}

      {/* MODAL 2: ITEM ADDITION CONFIRMATION MODAL */}
      {showAddModal && pendingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Agregar Producto al Ingreso</h3>
                <p className="text-xs text-slate-400">Verifica costo y precio sugerido</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Product Header */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">{pendingProduct.brand || 'Sin Marca'}</span>
                <h4 className="text-sm font-bold text-slate-900">{pendingProduct.name}</h4>
                <p className="text-slate-500 font-mono">
                  EAN: {pendingProduct.barcode} {pendingProduct.presentation && `• ${pendingProduct.presentation}`}
                </p>
                <p className="text-[11px] text-slate-600 pt-1">
                  Stock Físico Actual: <span className="font-bold font-mono text-slate-900">{pendingProduct.stockQuantity} un.</span>
                </p>
              </div>

              {/* Quantity & Unit Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
                  <label className="block text-[10px] font-bold text-emerald-900 uppercase mb-1">
                    Cantidad a Ingresar <span className="text-rose-500">*</span>
                  </label>
                  <NumericInput
                    min="1"
                    allowDecimal={false}
                    value={pendingQty}
                    onChangeValue={(val) => setPendingQty(val || 1)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl">
                  <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">
                    Costo Unitario ($) <span className="text-rose-500">*</span>
                  </label>
                  <NumericInput
                    min="0"
                    step="any"
                    allowDecimal={true}
                    value={pendingCost}
                    onChangeValue={(c) => {
                      setPendingCost(c);
                      const sugg = calculateSuggestedSalePrice(c);
                      const prevCost = pendingProduct.currentCost ?? pendingProduct.lastCost ?? pendingProduct.costPrice ?? 0;
                      if (c > prevCost || (pendingProduct.salePrice || 0) === 0) {
                        setPendingFinalSalePrice(sugg);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Automatic Margin Rule Calculation Display */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300 font-medium">Margen Automático (Costo / 0.60):</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">${pendingSuggestedSalePrice}</span>
                </div>

                {/* Price Adjustment Logic Banner */}
                {(() => {
                  const prevCost = pendingProduct.currentCost ?? pendingProduct.lastCost ?? pendingProduct.costPrice ?? 0;
                  const currentSalePrice = pendingProduct.salePrice ?? 0;

                  if (pendingCost > prevCost && prevCost > 0) {
                    return (
                      <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-[11px] text-amber-200 space-y-0.5">
                        <p className="font-bold flex items-center gap-1 text-amber-300">
                          <TrendingUp className="w-3.5 h-3.5" /> El costo aumentó (${prevCost} ➔ ${pendingCost})
                        </p>
                        <p>
                          Precio de venta habitual (${currentSalePrice}) ➔ Nuevo sugerido: <span className="font-bold text-white">${pendingSuggestedSalePrice}</span>
                        </p>
                      </div>
                    );
                  } else if (pendingCost <= prevCost && prevCost > 0) {
                    return (
                      <div className="p-2.5 bg-blue-500/20 border border-blue-500/40 rounded-xl text-[11px] text-blue-200">
                        <p className="font-semibold flex items-center gap-1 text-blue-300">
                          <Info className="w-3.5 h-3.5" /> El costo no aumentó (${prevCost} ➔ ${pendingCost}).
                        </p>
                        <p>El precio habitual se mantiene en ${currentSalePrice || pendingSuggestedSalePrice}.</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Final Sale Price Custom Input */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <label className="block text-[10px] font-bold text-emerald-900 uppercase mb-1">
                  Precio de Venta Final ($)
                </label>
                <NumericInput
                  min="0"
                  step="any"
                  allowDecimal={true}
                  value={pendingFinalSalePrice}
                  onChangeValue={(val) => setPendingFinalSalePrice(val)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-emerald-900 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddItem}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Agregar al Ingreso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: BARCODE SCANNER MODAL */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-emerald-600" />
                Escanear Producto para Ingreso
              </h3>
              <button
                onClick={() => setShowScannerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <BarcodeScanner
              onScanSuccess={handleBarcodeScanned}
              isScanningActive={true}
            />

            <button
              onClick={() => setShowScannerModal(false)}
              className="w-full py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
            >
              Cerrar Escáner
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: INLINE NEW PRODUCT CREATION */}
      {showNewProductForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <ProductForm
            initialBarcode={scannedBarcode}
            isEditing={false}
            source="manual"
            onSubmit={handleSaveNewProduct}
            onCancel={() => setShowNewProductForm(false)}
          />
        </div>
      )}
    </div>
  );
};
