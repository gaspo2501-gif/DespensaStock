import React from 'react';
import { Product, getStockForLocation, getTotalStock } from '../../types/product';
import { 
  Package, 
  Barcode, 
  Building2, 
  DollarSign, 
  Layers, 
  Calendar, 
  Truck, 
  X, 
  AlertTriangle, 
  Edit3 
} from 'lucide-react';
import { formatLocalDate } from '../../utils/dateUtils';
import { getCategoryBadgeColor } from '../../utils/categories';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onEditProduct?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onEditProduct,
}) => {
  const stockAimogasta = getStockForLocation(product, 'aimogasta');
  const stockOlascoaga = getStockForLocation(product, 'olascoaga');
  const stockTotal = getTotalStock(product);
  const cost = product.currentCost || product.lastCost || product.costPrice || 0;
  const categoryColor = getCategoryBadgeColor(product.category);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90dvh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">Ficha Técnica del Producto</h3>
              <p className="text-[11px] text-slate-400">Detalle operativo y de inventario</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Main Info */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Package className="w-9 h-9 text-slate-300 stroke-[1.5]" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${categoryColor}`}>
                  {product.category || 'General'}
                </span>
                {product.brand && (
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                    {product.brand}
                  </span>
                )}
              </div>

              <h2 className="text-base font-black text-slate-900 leading-snug">
                {product.name}
              </h2>

              {product.presentation && (
                <p className="text-xs text-slate-500 font-medium">{product.presentation}</p>
              )}

              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 pt-1">
                <Barcode className="w-4 h-4 text-slate-400" />
                <span className="font-bold tracking-wider">{product.barcode}</span>
              </div>
            </div>
          </div>

          {/* Stock by Location */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              Stock por Sucursal
            </span>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2.5 bg-white border border-slate-200/80 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Aimogasta</span>
                <span className="text-lg font-black font-mono text-emerald-700">{stockAimogasta}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200/80 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Olascoaga</span>
                <span className="text-lg font-black font-mono text-emerald-700">{stockOlascoaga}</span>
              </div>
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                <span className="text-[10px] font-bold text-emerald-100 block uppercase">Total</span>
                <span className="text-lg font-black font-mono">{stockTotal}</span>
              </div>
            </div>
          </div>

          {/* Prices & Financials */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Precio de Venta
              </span>
              <p className="text-lg font-black font-mono text-blue-700">
                {product.salePrice ? `$${product.salePrice.toLocaleString('es-AR')}` : 'No definido'}
              </p>
            </div>

            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Último Costo
              </span>
              <p className="text-lg font-black font-mono text-slate-700">
                {cost > 0 ? `$${cost.toLocaleString('es-AR')}` : 'No registrado'}
              </p>
            </div>
          </div>

          {/* Additional details */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
            {product.lastSupplierName && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  Último Proveedor:
                </span>
                <span className="font-bold text-slate-800">{product.lastSupplierName}</span>
              </div>
            )}

            {product.lastPurchaseDate && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Último Ingreso:
                </span>
                <span className="font-bold text-slate-800">{formatLocalDate(product.lastPurchaseDate)}</span>
              </div>
            )}

            {product.description && (
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">Descripción:</span>
                <p className="text-slate-600 leading-relaxed">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {onEditProduct ? (
            <button
              onClick={() => {
                onClose();
                onEditProduct(product);
              }}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Editar Producto</span>
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
