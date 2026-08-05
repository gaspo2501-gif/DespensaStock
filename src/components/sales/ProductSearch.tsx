import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '../../types/product';
import { Search, X, Plus } from 'lucide-react';

interface ProductSearchProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const ProductSearch: React.FC<ProductSearchProps> = ({
  products,
  onSelectProduct,
  placeholder = 'Buscar por nombre, marca, presentación o código EAN...',
  className = '',
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim().toLowerCase();
  const isQueryValid = trimmedQuery.length >= 2;

  // Real-time filtering across name, brand, presentation, barcode
  const searchResults = useMemo(() => {
    if (!isQueryValid) return [];

    return products.filter((p) => {
      const name = p.name ? p.name.toLowerCase() : '';
      const brand = p.brand ? p.brand.toLowerCase() : '';
      const presentation = p.presentation ? p.presentation.toLowerCase() : '';
      const barcode = p.barcode ? p.barcode.toLowerCase() : '';

      return (
        name.includes(trimmedQuery) ||
        brand.includes(trimmedQuery) ||
        presentation.includes(trimmedQuery) ||
        barcode.includes(trimmedQuery)
      );
    }).slice(0, 25); // Limit to top 25 matches for fluid performance
  }, [products, trimmedQuery, isQueryValid]);

  // Handle clicking outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (product: Product) => {
    onSelectProduct(product);
    setQuery('');
    setIsOpen(false);
    // Refocus input for immediate subsequent searches
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
          <Search className="w-5 h-5 stroke-[2.2]" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (trimmedQuery.length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-11 pr-10 py-3 bg-white border-2 border-emerald-500/40 focus:border-emerald-600 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-all"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            title="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Helper text if 1 character is entered */}
      {query.length === 1 && (
        <p className="text-[11px] font-medium text-slate-400 mt-1 pl-3">
          Escribí al menos 2 caracteres para buscar...
        </p>
      )}

      {/* Floating Results Dropdown */}
      {isOpen && isQueryValid && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[380px] flex flex-col animate-fadeIn">
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Resultados ({searchResults.length})</span>
            <span className="text-slate-400 normal-case font-normal">Toca un producto para agregar</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 p-1.5">
            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                <p className="font-bold text-slate-700">Sin coincidencias</p>
                <p className="text-slate-400">
                  No se encontraron productos para "<span className="font-semibold text-slate-600">{query}</span>"
                </p>
              </div>
            ) : (
              searchResults.map((product) => {
                const stock = product.stockQuantity || 0;
                const hasStock = stock > 0;
                const salePrice = typeof product.salePrice === 'number' && product.salePrice >= 0
                  ? `$${product.salePrice.toLocaleString('es-AR')}`
                  : 'Sin precio';

                return (
                  <div
                    key={product.id}
                    onClick={() => handleSelect(product)}
                    className="p-3 hover:bg-emerald-50/70 border-b border-slate-100 last:border-0 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3 group active:bg-emerald-100/80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-950 truncate">
                          {product.name}
                        </h4>
                        {product.brand && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 group-hover:bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            {product.brand}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                        {product.presentation && (
                          <span className="font-medium text-slate-600">{product.presentation}</span>
                        )}
                        {product.barcode && (
                          <span className="font-mono text-slate-400 text-[10px]">EAN: {product.barcode}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-extrabold text-emerald-700 font-mono">
                          {salePrice}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            hasStock
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-rose-100 text-rose-700 font-extrabold'
                          }`}
                        >
                          Stock: {stock}
                        </span>
                      </div>
                    </div>

                    {/* Direct Add Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(product);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1 shadow-2xs ${
                        hasStock
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white group-hover:scale-102'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{hasStock ? 'AGREGAR' : 'SIN STOCK'}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
