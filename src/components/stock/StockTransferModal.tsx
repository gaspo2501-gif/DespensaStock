import React, { useState } from 'react';
import { ArrowLeftRight, X, AlertCircle, CheckCircle2, Loader2, Building2, Package } from 'lucide-react';
import { Product, getProductStock } from '../../types/product';
import { LocationId, getLocationName } from '../../types/location';
import { stockTransferService } from '../../services/firebase/stockTransferService';

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
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const sourceStock = selectedProduct ? getProductStock(selectedProduct, fromLocation) : 0;
  const targetStock = selectedProduct ? getProductStock(selectedProduct, toLocation) : 0;

  const handleSwapLocations = () => {
    setFromLocation(toLocation);
    setToLocation(fromLocation);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedProduct) {
      setError('Por favor seleccioná un producto');
      return;
    }

    const numQty = parseInt(quantity, 10);
    if (isNaN(numQty) || numQty <= 0) {
      setError('La cantidad a transferir debe ser al menos 1');
      return;
    }

    if (numQty > sourceStock) {
      setError(`Stock insuficiente en ${getLocationName(fromLocation)}. Disponible: ${sourceStock}`);
      return;
    }

    if (fromLocation === toLocation) {
      setError('El origen y el destino no pueden ser la misma ubicación');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await stockTransferService.transferStock({
        productId: selectedProductId,
        sourceLocationId: fromLocation,
        destinationLocationId: toLocation,
        quantity: numQty,
        notes,
      });

      setSuccessMsg(`Transferencia realizada con éxito: ${numQty} unidad(es) enviada(s) a ${getLocationName(toLocation)}.`);
      
      const allProducts = products.map(p => p.id === result.updatedProduct.id ? result.updatedProduct : p);
      onTransferSuccess(allProducts);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error al ejecutar transferencia:', err);
      setError(err.message || 'Ocurrió un error al procesar la transferencia de stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
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
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Location selector flow */}
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
              className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs self-center my-auto"
              title="Cambiar dirección"
            >
              <ArrowLeftRight className="w-4 h-4" />
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

          {/* Product Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Producto
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              required
            >
              <option value="">-- Seleccionar producto del catálogo --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.brand ? `(${p.brand})` : ''} - Total: {p.stockQuantity ?? p.stock ?? 0} u.
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Indicators */}
          {selectedProduct && (
            <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Stock en {getLocationName(fromLocation)}:</span>
                <p className="text-sm font-extrabold text-slate-900">{sourceStock} u.</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Stock en {getLocationName(toLocation)}:</span>
                <p className="text-sm font-extrabold text-slate-900">{targetStock} u.</p>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Cantidad a transferir
            </label>
            <input
              type="number"
              min="1"
              max={sourceStock > 0 ? sourceStock : 1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Observaciones (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Reposición por falta de stock..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Submit buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedProductId || sourceStock <= 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Transferiendo...</span>
                </>
              ) : (
                <>
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Confirmar Transferencia</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
