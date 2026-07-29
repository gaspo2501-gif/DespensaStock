import React, { useState, useMemo } from 'react';
import { Product } from '../types/product';
import { ProductCard } from '../components/product/ProductCard';
import { Package, Plus, SortAsc, Filter, Search } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../utils/categories';

interface ProductListPageProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAddNewProduct: () => void;
}

export const ProductListPage: React.FC<ProductListPageProps> = ({
  products,
  onSelectProduct,
  onEditProduct,
  onDeleteProduct,
  onAddNewProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'brand' | 'date'>('name');

  const processedProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        p.barcode.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    // Sort alphabetically by name (default) or by brand or date
    result.sort((a, b) => {
      if (sortBy === 'brand') {
        return a.brand.localeCompare(b.brand, 'es');
      }
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });

    return result;
  }, [products, searchTerm, selectedCategory, sortBy]);

  return (
    <div className="space-y-5 pb-20 animate-fadeIn">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Catálogo de Productos
          </h2>
          <p className="text-xs text-slate-500">
            {products.length} productos almacenados en tu base propia de Firebase
          </p>
        </div>

        <button
          onClick={onAddNewProduct}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo</span>
        </button>
      </div>

      {/* Filter and Sort bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por nombre, marca o código..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              selectedCategory === 'all'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos ({products.length})
          </button>

          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                selectedCategory === cat.name
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-medium">
            <SortAsc className="w-3.5 h-3.5 text-slate-400" />
            <span>Ordenar por:</span>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setSortBy('name')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] ${
                sortBy === 'name' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Nombre (A-Z)
            </button>

            <button
              onClick={() => setSortBy('date')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] ${
                sortBy === 'date' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Más Recientes
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Product Cards */}
      {processedProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {processedProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => onSelectProduct(p)}
              onEdit={(e) => {
                e.stopPropagation();
                onEditProduct(p);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                onDeleteProduct(p.id);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto stroke-[1.25]" />
          <h3 className="text-sm font-bold text-slate-800">Sin productos en este listado</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {searchTerm || selectedCategory !== 'all'
              ? 'Prueba modificando tus filtros o borrando el texto de búsqueda.'
              : 'Presiona "Nuevo" o escanea con la cámara para comenzar a armar tu catálogo.'}
          </p>
        </div>
      )}
    </div>
  );
};
