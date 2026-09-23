import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeftRight, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Building2, 
  Package, 
  Camera, 
  RotateCcw, 
  Check, 
  Search 
} from 'lucide-react';
import { Product, getProductStock } from '../../types/product';
import { LocationId, getLocationName } from '../../types/location';
import { stockTransferService } from '../../services/firebase/stockTransferService';
import { ProductSearch } from '../sales/ProductSearch';
import { BarcodeScanner } from '../scanner/BarcodeScanner';
import { NumericInput } from '../common/NumericInput';

interface StockTransferModalProps {
  products: Product[];
  onClose: () => void;
  onTransferSuccess: (updatedProducts: Product[]) => void;
  initialProductId?: string;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  products,
  onClose,
  onTransferSuccess,
  initialProductId,
}) => {
  const [fromLocation, setFromLocation] = useState<LocationId>('aimogasta');
  const [toLocation, setToLocation] = useState<LocationId>('olascoaga');
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || '');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [notes, setNotes] = useState<string>('');

  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success view state
  const [completedTransfer, setCompletedTransfer] = useState<{
    productName: string;
    quantity: number;
    sourceLocationName: string;
    targetLocationName: string;
    prevSourceStock: number;
    newSourceStock: number;
    prevTargetStock: number;
    newTargetStock: number;
  } | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const sourceStock = selectedProduct ? getProductStock(selectedProduct, fromLocation) : 0;
  const targetStock = selectedProduct ? getProductStock(selectedProduct, toLocation) : 0;

  // Lock background scroll while modal is active and restore on unmount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const numQty = typeof quantity === 'number' ? quantity : parseInt(quantity, 10) || 0;

  const handleSwapLocations = () => {
    setFromLocation(toLocation);
    setToLocation(fromLocation);
    setError(null);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setQuantity(1);
    setError(null);
    setScannerError(null);
  };

  const handleScanSuccess = (barcode: string) => {
    const cleanCode = barcode.trim().toLowerCase();
    const found = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === cleanCode
    );

    if (found) {
      setSelectedProductId(found.id);
      setQuantity(1);
      setIsScannerOpen(false);
      setScannerError(null);
      setError(null);
    } else {
      setScannerError('Producto no encontrado en el catálogo.');
    }
  };

  const handleNewTransfer = () => {
    setSelectedProductId('');
    setQuantity(1);
    setNotes('');
    setCompletedTransfer(null);
    setError(null);
    setScannerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedProduct) {
      setError('Por favor seleccioná un producto.');
      return;
    }

    if (fromLocation === toLocation) {
      setError('El origen y el destino no pueden ser la misma ubicación.');
      return;
    }

    if (isNaN(numQty) || numQty <= 0) {
      setError('La cantidad a transferir debe ser al menos 1 unidad.');
      return;
    }

    if (numQty > sourceStock) {
      setError(`Stock insuficiente. Disponible en ${getLocationName(fromLocation)}: ${sourceStock} unidades.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await stockTransferService.transferStock({
        productId: selectedProductId,
        sourceLocationId: fromLocation,
        destinationLocationId: toLocation,
        quantity: numQty,
        notes,
      });

      const updatedProds = products.map((p) =>
        p.id === result.updatedProduct.id ? result.updatedProduct : p
      );

      onTransferSuccess(updatedProds);

      setCompletedTransfer({
        productName: `${selectedProduct.name}${selectedProduct.presentation ? ` (${selectedProduct.presentation})` : ''}`,
        quantity: numQty,
        sourceLocationName: getLocationName(fromLocation),
        targetLocationName: getLocationName(toLocation),
        prevSourceStock: sourceStock,
        newSourceStock: sourceStock - numQty,
        prevTargetStock: targetStock,
        newTargetStock: targetStock + numQty,
      });
    } catch (err: any) {
      console.error('Error al ejecutar transferencia:', err);
      setError(err.message || 'Ocurrió un error al procesar la transferencia de stock');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-fade-in my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Transferencia de Stock</h2>
              <p className="text-xs text-slate-300">Mover mercadería entre sucursales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Branch Location Flow (DESDE / HACIA) */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            {/* From */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Desde (Origen)</span>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>{getLocationName(fromLocation)}</span>
              </div>
            </div>

            {/* Swap Button */}
            <button
              type="button"
              onClick={handleSwapLocations}
              className="p-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs self-center justify-self-center my-auto flex items-center gap-1 text-xs font-bold"
              title="Invertir sucursales origen y destino"
            >
              <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
              <span className="sm:hidden text-[11px] text-slate-500">Invertir</span>
            </button>

            {/* To */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hacia (Destino)</span>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>{getLocationName(toLocation)}</span>
              </div>
            </div>
          </div>

          {/* SUCCESS SCREEN */}
          {completedTransfer ? (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-800 font-extrabold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>✅ TRANSFERENCIA REALIZADA</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Producto:</span>
                    <span className="font-extrabold text-slate-900">{completedTransfer.productName}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Cantidad transferida:</span>
                    <span className="font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md font-mono text-xs">
                      {completedTransfer.quantity} u.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        {completedTransfer.sourceLocationName}
                      </span>
                      <p className="text-xs font-mono font-extrabold text-slate-800 mt-0.5">
                        {completedTransfer.prevSourceStock} → <span className="text-rose-600">{completedTransfer.newSourceStock}</span>
                      </p>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        {completedTransfer.targetLocationName}
                      </span>
                      <p className="text-xs font-mono font-extrabold text-slate-800 mt-0.5">
                        {completedTransfer.prevTargetStock} → <span className="text-emerald-600">{completedTransfer.newTargetStock}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Success Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleNewTransfer}
                  className="w-full sm:flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>NUEVA TRANSFERENCIA</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE FORM FLOW */
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs font-medium animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* PRODUCT SELECTION OR SELECTED CARD */}
              {!selectedProduct ? (
                /* METHOD A & B: Product Search + Barcode Button */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Seleccionar Producto
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Stock en {getLocationName(fromLocation)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="flex-1 min-w-0">
                      <ProductSearch
                        products={products}
                        onSelectProduct={handleSelectProduct}
                        onBarcodeNotFound={handleScanSuccess}
                        placeholder="🔎 Buscar producto por nombre, marca, presentación o código..."
                        locationId={fromLocation}
                        showPrice={false}
                        autoFocus={true}
                        showScannerIndicator={true}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setScannerError(null);
                        setIsScannerOpen(true);
                      }}
                      className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shrink-0 shadow-md transition-all active:scale-[0.98]"
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>ESCANEAR CÓDIGO</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* SELECTED PRODUCT CARD */
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                      PRODUCTO SELECCIONADO
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProductId('')}
                      className="text-xs font-extrabold text-slate-500 hover:text-emerald-700 hover:underline transition-colors"
                    >
                      Cambiar producto
                    </button>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-slate-900">{selectedProduct.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                      {selectedProduct.brand && (
                        <span className="font-semibold text-slate-700">{selectedProduct.brand}</span>
                      )}
                      {selectedProduct.presentation && (
                        <span>· {selectedProduct.presentation}</span>
                      )}
                      {selectedProduct.barcode && (
                        <span className="font-mono text-[11px] text-slate-400">EAN: {selectedProduct.barcode}</span>
                      )}
                    </div>
                  </div>

                  {/* CURRENT STOCK DISPLAY IN BOTH LOCATIONS */}
                  <div className="space-y-1">
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      STOCK ACTUAL
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">
                          {getLocationName(fromLocation)} (Origen)
                        </span>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                          {sourceStock} <span className="text-xs font-normal text-slate-500">unidades</span>
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">
                          {getLocationName(toLocation)} (Destino)
                        </span>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                          {targetStock} <span className="text-xs font-normal text-slate-500">unidades</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* QUANTITY INPUT */}
              {selectedProduct && (
                <div className="space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Cantidad a transferir
                    </label>
                    <span className="text-[11px] font-bold text-slate-500">
                      Máximo disponible: {sourceStock} u.
                    </span>
                  </div>

                  <NumericInput
                    value={quantity}
                    allowDecimal={false}
                    min={1}
                    max={sourceStock > 0 ? sourceStock : 1}
                    onChangeValue={(val) => {
                      setQuantity(val);
                      setError(null);
                    }}
                    onChangeRaw={(e) => {
                      setQuantity(e.target.value);
                      setError(null);
                    }}
                    placeholder="1"
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-all"
                  />

                  {sourceStock <= 0 ? (
                    <p className="text-xs text-rose-600 font-semibold mt-1">
                      ⚠️ Sin stock disponible en {getLocationName(fromLocation)} para realizar transferencias.
                    </p>
                  ) : numQty > sourceStock ? (
                    <p className="text-xs text-rose-600 font-semibold mt-1">
                      ⚠️ Stock insuficiente. Disponible en {getLocationName(fromLocation)}: {sourceStock} unidades.
                    </p>
                  ) : null}
                </div>
              )}

              {/* TRANSFER PREVIEW SUMMARY */}
              {selectedProduct && numQty > 0 && numQty <= sourceStock && fromLocation !== toLocation && (
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>RESUMEN DE TRANSFERENCIA</span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-700">
                    <p>
                      <span className="font-bold">Producto:</span> {selectedProduct.name} {selectedProduct.presentation || ''}
                    </p>
                    <p>
                      <span className="font-bold">Cantidad:</span> {numQty} unidad(es)
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="block text-[10px] font-bold text-slate-500 font-sans">
                          {getLocationName(fromLocation)}
                        </span>
                        <span className="font-extrabold text-slate-900">
                          {sourceStock} → <span className="text-rose-600">{sourceStock - numQty}</span>
                        </span>
                      </div>

                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="block text-[10px] font-bold text-slate-500 font-sans">
                          {getLocationName(toLocation)}
                        </span>
                        <span className="font-extrabold text-slate-900">
                          {targetStock} → <span className="text-emerald-600">{targetStock + numQty}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* NOTES */}
              {selectedProduct && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Observaciones (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Reposición por falta de stock..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              )}

              {/* SUBMIT BUTTONS */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedProductId || sourceStock <= 0 || numQty <= 0 || numQty > sourceStock || fromLocation === toLocation}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transferiendo...</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>CONFIRMAR TRANSFERENCIA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* BARCODE SCANNER MODAL OVERLAY */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-auto space-y-3">
            <div className="px-5 py-3.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Escanear Código de Barras
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsScannerOpen(false);
                  setScannerError(null);
                }}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 space-y-3">
              {scannerError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-2 text-rose-300 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{scannerError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScannerError(null)}
                    className="text-[11px] underline text-rose-300 hover:text-white"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              <BarcodeScanner
                isScanningActive={isScannerOpen}
                onScanSuccess={handleScanSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
