import React, { useState } from 'react';
import { Product } from '../../types/product';
import { Barcode, Package, Edit3, Trash2, ArrowRight } from 'lucide-react';
import { getCategoryBadgeColor } from '../../utils/categories';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  showActions?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick,
  onEdit,
  onDelete,
  showActions = true,
}) => {
  const [imgError, setImgError] = useState(false);

  const sourceLabels = {
    local: { label: 'Base Propia', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    external_api: { label: 'API Externa', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    manual: { label: 'Carga Manual', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
  };

  const currentSource = sourceLabels[product.source] || sourceLabels.manual;
  const categoryColor = getCategoryBadgeColor(product.category);

  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-[20px] border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-sm transition-all duration-200 overflow-hidden flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="p-4 space-y-3">
        {/* Top Header: Category, Source & Stock */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${categoryColor}`}>
            {product.category || 'Sin Categoría'}
          </span>

          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
              (product.stockQuantity ?? 0) > 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              Stock: {product.stockQuantity ?? 0}
            </span>

            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${currentSource.bg}`}>
              {currentSource.label}
            </span>
          </div>
        </div>

        {/* Image & Title Body */}
        <div className="flex items-start gap-3 pt-1">
          {/* Image Container */}
          <div className="relative w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {product.imageUrl && !imgError ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain p-1"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-300">
                <Package className="w-7 h-7 stroke-[1.5]" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            {product.brand && (
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide truncate">
                {product.brand}
              </p>
            )}
            
            <h3 className="text-sm font-extrabold text-slate-900 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
              {product.name}
            </h3>

            {product.presentation && (
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {product.presentation}
              </p>
            )}
          </div>
        </div>

        {/* Barcode Tag */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono bg-slate-50/80 -mx-4 -mb-4 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-slate-400" />
            <span className="font-bold tracking-wider text-slate-800">{product.barcode}</span>
          </div>

          {showActions ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          )}
        </div>
      </div>
    </div>
  );
};
