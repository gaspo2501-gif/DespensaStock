import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, getProductStock } from '../../types/product';
import { getLocationName } from '../../types/location';
import { Search, X, Plus, Scan } from 'lucide-react';

interface ProductSearchProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onBarcodeNotFound?: (barcode: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  locationId?: string;
  showPrice?: boolean;
  showScannerIndicator?: boolean;
  inputRef?: React.RefObject<HTMLInputElement> | React.MutableRefObject<HTMLInputElement | null>;
}

export const ProductSearch: React.FC<ProductSearchProps> = ({
  products,
  onSelectProduct,
  onBarcodeNotFound,
  placeholder = 'Buscar por nombre, marca, presentación o código EAN...',
  className = '',
  autoFocus = false,
  locationId,
  showPrice = true,
  showScannerIndicator = true,
  inputRef: externalInputRef,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;
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
    // Refocus input for immediate subsequent searches/scans
    setTimeout(() => {
      if (inputRef && 'current' in inputRef && inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    if (inputRef && 'current' in inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Process ENTER key from USB Barcode scanner or keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const cleanCode = query.trim().toLowerCase();
      if (!cleanCode) return;

      // 1. Try exact EAN / Barcode match first
      const exactBarcodeMatch = products.find(
        (p) => p.barcode && p.barcode.trim().toLowerCase() === cleanCode
      );

      if (exactBarcodeMatch) {
        handleSelect(exactBarcodeMatch);
        return;
      }

      // 2. Fallback to top search result if available
      if (searchResults.length > 0) {
        handleSelect(searchResults[0]);
        return;
      }

      // 3. No product match found for scanned code
      if (onBarcodeNotFound) {
        onBarcodeNotFound(query.trim());
      }
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box with USB Scanner indicator */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
          <Search className="w-5 h-5 stroke-[2.2]" />
        </div>

        <input
          ref={inputRef as any}
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
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-11 ${
            showScannerIndicator ? (query ? 'pr-36' : 'pr-32') : query ? 'pr-10' : 'pr-4'
          } py-3 bg-white border-2 border-emerald-500/40 focus:border-emerald-600 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-all`}
        />

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className={`absolute ${
              showScannerIndicator ? 'right-28' : 'right-3'
            } top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors`}
            title="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Discrete USB Scanner Badge */}
        {showScannerIndicator && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-[10px] font-extrabold text-emerald-700 pointer-events-none select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Lector USB listo</span>
            <Scan className="w-3 h-3 sm:hidden text-emerald-600" />
          </div>
        )}
      </div>

      {/* Helper text if 1 character is entered */}
      {query.length === 1 && (
        <p className="text-[11px] font-medium text-slate-400 mt-1 pl-3">
          Escribí al menos 2 caracteres o escaneá con el lector USB...
        </p>
      )}

      {/* Floating Results Dropdown */}
      {isOpen && isQueryValid && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[380px] flex flex-col animate-fadeIn">
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Resultados ({searchResults.length})</span>
            <span className="text-slate-400 normal-case font-normal">
              Presioná ENTER o toca para seleccionar
            </span>
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
              searchResults.map((product, index) => {
                const stock = locationId 
                  ? getProductStock(product, locationId) 
                  : (product.stockQuantity ?? product.stock ?? 0);
                const hasStock = stock > 0;
                const salePrice = typeof product.salePrice === 'number' && product.salePrice >= 0
                  ? `$${product.salePrice.toLocaleString('es-AR')}`
                  : 'Sin precio';

                return (
                  <div
                    key={product.id}
                    onClick={() => handleSelect(product)}
                    className={`p-3 hover:bg-emerald-50/70 border-b border-slate-100 last:border-0 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3 group active:bg-emerald-100/80 ${
                      index === 0 ? 'bg-emerald-50/30' : ''
                    }`}
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
                        {index === 0 && searchResults.length > 1 && (
                          <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                            ENTER
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

                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {showPrice && (
                          <span className="text-xs font-extrabold text-emerald-700 font-mono">
                            {salePrice}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            hasStock
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-rose-100 text-rose-700 font-extrabold'
                          }`}
                        >
                          {locationId ? `Stock en ${getLocationName(locationId)}: ${stock}` : `Stock: ${stock}`}
                        </span>
                      </div>
                    </div>

                    {/* Direct Select Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(product);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1 shadow-2xs ${
                        hasStock
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white group-hover:scale-102'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>SELECCIONAR</span>
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
