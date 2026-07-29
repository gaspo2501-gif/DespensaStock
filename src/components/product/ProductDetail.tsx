import React, { useState } from 'react';
import { Product } from '../../types/product';
import { 
  Barcode, 
  Package, 
  Tag, 
  Calendar, 
  Database, 
  Edit3, 
  Trash2, 
  ScanLine, 
  ArrowLeft,
  AlertTriangle,
  Info
} from 'lucide-react';
import { getCategoryBadgeColor } from '../../utils/categories';

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onScanAnother?: () => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  onClose,
  onEdit,
  onDelete,
  onScanAnother,
}) => {
  const [imgError, setImgError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const sourceMap = {
    local: { label: 'Guardado en Base Propia (Firebase)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    external_api: { label: 'Importado de Base Externa', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    manual: { label: 'Cargado Manualmente', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  };

  const sourceInfo = sourceMap[product.source] || sourceMap.manual;
  const categoryBadgeClass = getCategoryBadgeColor(product.category);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Fecha desconocida';
    try {
      return new Date(isoString).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    await onDelete(product.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header navigation bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          
          <h2 className="text-sm font-bold text-slate-800">Ficha del Producto</h2>

          {onScanAnother && (
            <button
              onClick={onScanAnother}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-xs transition-all"
            >
              <ScanLine className="w-3.5 h-3.5" />
              Escanear
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Product Hero */}
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Large Image Frame */}
            <div className="w-32 h-32 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center flex-shrink-0 shadow-inner">
              {product.imageUrl && !imgError ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain"
                  onError={() => setImgError(true)}
                />
              ) : (
                <Package className="w-16 h-16 text-slate-300 stroke-[1.25]" />
              )}
            </div>

            {/* Title Block */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              {product.brand && (
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {product.brand}
                </span>
              )}
              <h1 className="text-xl font-extrabold text-slate-900 leading-tight">
                {product.name}
              </h1>
              {product.presentation && (
                <p className="text-sm font-semibold text-slate-500">
                  Presentación: {product.presentation}
                </p>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${categoryBadgeClass}`}>
                  {product.category || 'Sin Categoría'}
                </span>
              </div>
            </div>
          </div>

          {/* Barcode Highlight Box */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Barcode className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Código de Barras</p>
                <p className="text-lg font-mono font-bold tracking-widest text-emerald-400">{product.barcode}</p>
              </div>
            </div>
          </div>

          {/* Description Section */}
          {product.description && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Info className="w-4 h-4 text-emerald-600" />
                Descripción del Producto
              </div>
              <p className="text-sm text-slate-600 leading-relaxed pt-1">{product.description}</p>
            </div>
          )}

          {/* Meta Information List */}
          <div className="space-y-2 text-xs">
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${sourceInfo.color}`}>
              <Database className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{sourceInfo.label}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Fecha de Registro:</span>
              </div>
              <span className="font-semibold text-slate-800">{formatDate(product.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row gap-2">
          {showDeleteConfirm ? (
            <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                ¿Confirmas eliminar este producto de la base de datos?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteConfirmed}
                  disabled={isDeleting}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => onEdit(product)}
                className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Edit3 className="w-4 h-4" />
                Editar Producto
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>

              {onScanAnother && (
                <button
                  onClick={onScanAnother}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <ScanLine className="w-4 h-4" />
                  Escanear Otro
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
