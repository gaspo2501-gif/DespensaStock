import React, { useState, useMemo } from 'react';
import { Product } from '../types/product';
import { ProductCard } from '../components/product/ProductCard';
import { Search, X, PackageSearch, Filter } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../utils/categories';

interface SearchPageProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  products,
  onSelectProduct,
  onEditProduct,
  onDeleteProduct,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();

    return products.filter((p) => {
      const matchesQuery = !term || (
        p.name.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        p.barcode.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
      );

      const matchesCat = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesQuery && matchesCat;
    });
  }, [products, query, selectedCategory]);

  return (
    <div className="space-y-5 pb-20 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Buscar Productos</h2>
        <p className="text-xs text-slate-500">Busca en tiempo real por nombre, marca o número de código de barras.</p>
      </div>

      {/* Search Input Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej: Fideos, Arcor, 779123456..."
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-xs"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Pills Filter */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          Filtrar por Categoría:
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todas ({products.length})
          </button>

          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                selectedCategory === cat.name
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1 border-b border-slate-200/80 pb-2">
        <span>Resultados encontrados: {filteredProducts.length}</span>
        {query && <span>Búsqueda: &quot;{query}&quot;</span>}
      </div>

      {/* Results List */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => onSelectProduct(product)}
              onEdit={(e) => {
                e.stopPropagation();
                onEditProduct(product);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                onDeleteProduct(product.id);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <PackageSearch className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No se encontraron productos</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {query
              ? `No hay coincidencias para "${query}". Intenta con otro término o escanéalo con la cámara.`
              : 'Tu catálogo aún no contiene productos con el filtro seleccionado.'}
          </p>
        </div>
      )}
    </div>
  );
};
