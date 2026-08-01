import React, { useState, useEffect, useCallback } from 'react';
import { NavigationTab, Product, CreateProductInput } from './types/product';
import { productService } from './services/firebase/productService';
import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { Home } from './pages/Home';
import { ScanPage } from './pages/ScanPage';
import { SearchPage } from './pages/SearchPage';
import { ProductListPage } from './pages/ProductListPage';
import { SalesPage } from './pages/SalesPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProductDetail } from './components/product/ProductDetail';
import { ProductForm } from './components/product/ProductForm';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showManualForm, setShowManualForm] = useState<boolean>(false);

  // Initial products fetch
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await productService.getAllProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('No se pudo sincronizar la lista de productos con Firebase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handlers
  const handleProductSaved = (newProduct: Product) => {
    setProducts((prev) => {
      const filtered = prev.filter((p) => p.id !== newProduct.id && p.barcode !== newProduct.barcode);
      return [newProduct, ...filtered].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    });
  };

  const handleProductsBatchUpdated = (updatedList: Product[]) => {
    setProducts((prev) => {
      const updatedMap = new Map(updatedList.map((p) => [p.id, p]));
      return prev.map((p) => updatedMap.get(p.id) || p);
    });
  };

  const handleUpdateProductSubmit = async (inputData: CreateProductInput) => {
    if (!editingProduct) return;
    const updated = await productService.updateProduct(editingProduct.id, {
      name: inputData.name,
      brand: inputData.brand,
      category: inputData.category,
      presentation: inputData.presentation,
      description: inputData.description,
      imageUrl: inputData.imageUrl,
      stockQuantity: inputData.stockQuantity,
      salePrice: inputData.salePrice,
    });

    handleProductSaved(updated);
    setEditingProduct(null);
    setSelectedProduct(updated);
  };

  const handleManualAddSubmit = async (inputData: CreateProductInput) => {
    const created = await productService.saveProduct(inputData);
    handleProductSaved(created);
    setShowManualForm(false);
    setSelectedProduct(created);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await productService.deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
      }
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-24">
        {loading && products.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">Cargando tu catálogo de Despensa Stock...</p>
            <p className="text-xs text-slate-400">Conectando a base de datos en Firebase</p>
          </div>
        ) : error && products.length === 0 ? (
          <div className="py-12 px-6 bg-white border border-rose-200 rounded-3xl text-center max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Error de conexión</h3>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchProducts}
              className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Tab Views */}
            {currentTab === 'home' && (
              <Home
                onNavigate={setCurrentTab}
                products={products}
                onSelectProduct={setSelectedProduct}
                onManualAdd={() => setShowManualForm(true)}
              />
            )}

            {currentTab === 'scan' && (
              <ScanPage
                onProductSaved={handleProductSaved}
                onBackToHome={() => setCurrentTab('home')}
              />
            )}

            {currentTab === 'search' && (
              <SearchPage
                products={products}
                onSelectProduct={setSelectedProduct}
                onEditProduct={(p) => setEditingProduct(p)}
                onDeleteProduct={handleDeleteProduct}
              />
            )}

            {currentTab === 'sales' && (
              <SalesPage
                products={products}
                onProductsUpdated={handleProductsBatchUpdated}
                onNavigateToScan={() => setCurrentTab('scan')}
                onNavigateHome={() => setCurrentTab('home')}
              />
            )}

            {currentTab === 'list' && (
              <ProductListPage
                products={products}
                onSelectProduct={setSelectedProduct}
                onEditProduct={(p) => setEditingProduct(p)}
                onDeleteProduct={handleDeleteProduct}
                onAddNewProduct={() => setShowManualForm(true)}
              />
            )}

            {currentTab === 'customers' && (
              <CustomersPage />
            )}
          </>
        )}
      </main>

      {/* Product Detail Sheet Modal */}
      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onEdit={(p) => {
            setSelectedProduct(null);
            setEditingProduct(p);
          }}
          onDelete={handleDeleteProduct}
          onProductUpdated={handleProductSaved}
          onScanAnother={() => {
            setSelectedProduct(null);
            setCurrentTab('scan');
          }}
        />
      )}

      {/* Editing Product Modal Form */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <ProductForm
            isEditing={true}
            initialData={editingProduct}
            source={editingProduct.source}
            onSubmit={handleUpdateProductSubmit}
            onCancel={() => setEditingProduct(null)}
          />
        </div>
      )}

      {/* Manual Creation Modal Form */}
      {showManualForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <ProductForm
            isEditing={false}
            source="manual"
            onSubmit={handleManualAddSubmit}
            onCancel={() => setShowManualForm(false)}
          />
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
      />
    </div>
  );
}
