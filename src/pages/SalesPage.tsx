import React, { useState } from 'react';
import { Product } from '../types/product';
import { CartItem, SaleRecord } from '../types/sale';
import { productService } from '../services/firebase/productService';
import { salesService } from '../services/firebase/salesService';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { playScanSound } from '../utils/audio';
import { 
  ShoppingCart, 
  ScanLine, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  DollarSign, 
  Package, 
  ArrowLeft,
  X,
  Sparkles
} from 'lucide-react';

interface SalesPageProps {
  products: Product[];
  onProductsUpdated: (updatedProducts: Product[]) => void;
  onNavigateToScan: () => void;
  onNavigateHome: () => void;
}

export const SalesPage: React.FC<SalesPageProps> = ({
  products,
  onProductsUpdated,
  onNavigateToScan,
  onNavigateHome,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Status & Feedback banners
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null);

  // Helper to clear feedback banner
  const clearFeedback = () => setFeedback(null);

  // Add product to cart logic
  const handleAddProductToCart = (product: Product) => {
    clearFeedback();

    const currentStock = product.stockQuantity || 0;

    // Rule: Out of stock
    if (currentStock <= 0) {
      playScanSound('error');
      setFeedback({
        type: 'error',
        message: `El producto '${product.name}' no tiene stock disponible (Stock: 0).`,
      });
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    const existingQty = existingIndex !== -1 ? cart[existingIndex].quantity : 0;

    // Rule: Stock limit
    if (existingQty + 1 > currentStock) {
      playScanSound('error');
      setFeedback({
        type: 'warning',
        message: `Stock insuficiente para '${product.name}'. Disponible: ${currentStock} unidades, ya agregaste ${existingQty} al carrito.`,
      });
      return;
    }

    playScanSound('success');

    if (existingIndex !== -1) {
      // Increment quantity automatically
      setCart((prev) => {
        const next = [...prev];
        const newQty = next[existingIndex].quantity + 1;
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: newQty,
          subtotal: newQty * next[existingIndex].unitPrice,
        };
        return next;
      });
      setFeedback({
        type: 'success',
        message: `Se incrementó '${product.name}' a ${existingQty + 1} unidades.`,
      });
    } else {
      // Add new cart line
      const defaultPrice = typeof product.salePrice === 'number' && product.salePrice >= 0 ? product.salePrice : 0;
      setCart((prev) => [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: defaultPrice,
          subtotal: defaultPrice,
        },
      ]);
      setFeedback({
        type: 'success',
        message: `¡'${product.name}' agregado al carrito!`,
      });
    }
  };

  // Barcode scan handler inside sales modal
  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const found = await productService.getByBarcode(barcode);
      if (found) {
        handleAddProductToCart(found);
      } else {
        playScanSound('error');
        setFeedback({
          type: 'error',
          message: `Código de barras ${barcode} no encontrado en el catálogo.`,
        });
      }
    } catch (err) {
      console.error('Error al buscar código:', err);
    }
  };

  // Modify Quantity
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    clearFeedback();

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === productId);
      if (idx === -1) return prev;

      const item = prev[idx];
      const maxStock = item.product.stockQuantity || 0;

      if (newQty <= 0) {
        return prev.filter((i) => i.product.id !== productId);
      }

      if (newQty > maxStock) {
        setFeedback({
          type: 'warning',
          message: `Stock insuficiente. El máximo disponible para '${item.product.name}' es de ${maxStock} unidades.`,
        });
        playScanSound('error');
        return prev;
      }

      const next = [...prev];
      next[idx] = {
        ...item,
        quantity: newQty,
        subtotal: newQty * item.unitPrice,
      };
      return next;
    });
  };

  // Modify Unit Price for specific sale
  const handleUpdateUnitPrice = (productId: string, priceInput: string) => {
    const numPrice = parseFloat(priceInput);
    const validPrice = isNaN(numPrice) || numPrice < 0 ? 0 : numPrice;

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === productId);
      if (idx === -1) return prev;

      const next = [...prev];
      const item = next[idx];
      next[idx] = {
        ...item,
        unitPrice: validPrice,
        subtotal: item.quantity * validPrice,
      };
      return next;
    });
  };

  // Remove Item
  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // Clear Cart
  const handleClearCart = () => {
    setCart([]);
    setFeedback(null);
  };

  // Totals calculations
  const totalAmount = cart.reduce((acc, curr) => acc + curr.subtotal, 0);
  const totalItemsCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  // Confirm Sale Execution
  const handleConfirmSale = async () => {
    if (cart.length === 0) return;
    clearFeedback();
    setIsProcessing(true);

    try {
      const result = await salesService.processSale(cart);
      onProductsUpdated(result.updatedProducts);
      setCompletedSale(result.sale);
      playScanSound('success');
      setCart([]);
    } catch (err: unknown) {
      playScanSound('error');
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al procesar la venta.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered products for quick manual search modal
  const searchResults = searchTerm.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.barcode.includes(searchTerm) ||
          p.brand.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : products.slice(0, 10);

  return (
    <div className="space-y-5 animate-fadeIn max-w-3xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Nueva Venta</h1>
            <p className="text-xs text-slate-500 font-medium">Escanea o agrega productos al carrito</p>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            onClick={handleClearCart}
            className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vaciar</span>
          </button>
        )}
      </div>

      {/* COMPLETED SALE CONFIRMATION SCREEN */}
      {completedSale ? (
        <div className="p-6 bg-white border border-emerald-200 rounded-3xl shadow-xl text-center space-y-5 animate-scaleUp">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Venta Exitosa
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">¡Venta Registrada!</h2>
            <p className="text-xs text-slate-500 mt-1">El stock ha sido descontado automáticamente en la base de datos.</p>
          </div>

          {/* Receipt Breakdown Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-3 font-mono">
            <div className="flex justify-between text-xs text-slate-500 border-b pb-2">
              <span>N° Registro:</span>
              <span className="font-bold text-slate-700">{completedSale.id}</span>
            </div>

            <div className="space-y-1 text-xs">
              {completedSale.items.map((item, i) => (
                <div key={i} className="flex justify-between text-slate-800">
                  <span className="truncate max-w-[200px]">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="font-bold">${item.subtotal.toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-2 flex justify-between items-center font-sans">
              <div>
                <p className="text-xs text-slate-500 font-bold">TOTAL VENDIDO</p>
                <p className="text-[11px] text-slate-400">{completedSale.totalItemsCount} unidades</p>
              </div>
              <p className="text-2xl font-black text-emerald-700 font-mono">
                ${completedSale.totalAmount.toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setCompletedSale(null)}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            Iniciar Nueva Venta
          </button>
        </div>
      ) : (
        <>
          {/* Action Scanning Bar */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="p-4 bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold text-xs shadow-md active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2 text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ScanLine className="w-6 h-6" />
              </div>
              <span>Escanear Producto</span>
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl font-bold text-xs shadow-xs active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2 text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Search className="w-5 h-5" />
              </div>
              <span>Buscar en Catálogo</span>
            </button>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : feedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedback.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                ) : feedback.type === 'warning' ? (
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button onClick={clearFeedback} className="p-1 hover:opacity-75">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Cart Contents */}
          {cart.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">El carrito está vacío</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Presiona "Escanear Producto" o busca manualmente en el catálogo para armar la venta.
                </p>
              </div>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-2"
              >
                <ScanLine className="w-4 h-4" />
                Escanear Primer Producto
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Productos en Carrito ({cart.length})
                </h2>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  {totalItemsCount} unidades en total
                </span>
              </div>

              {/* Cart List Items */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 relative"
                  >
                    {/* Top Row: Title, Stock badge & Delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 leading-tight">
                            {item.product.name}
                          </h3>
                          {item.product.brand && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {item.product.brand}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          EAN: {item.product.barcode} {item.product.presentation ? `| ${item.product.presentation}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Stock: {item.product.stockQuantity || 0}
                        </span>
                        <button
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Eliminar del carrito"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Controls Row: Quantity & Price */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      {/* Quantity Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Cant:</span>
                        <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 text-slate-800 font-bold transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.product.stockQuantity || 1}
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.product.id, parseInt(e.target.value, 10) || 1)}
                            className="w-12 h-8 bg-white text-center font-mono font-bold text-xs text-slate-900 focus:outline-none border-x border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 text-slate-800 font-bold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Editable Price Input & Subtotal */}
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Precio ($):</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                            placeholder="0"
                            onChange={(e) => handleUpdateUnitPrice(item.product.id, e.target.value)}
                            className="w-20 h-8 px-2 bg-slate-50 border border-slate-300 rounded-xl text-center font-mono font-bold text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Subtotal</p>
                          <p className="text-sm font-extrabold text-slate-900 font-mono">
                            ${item.subtotal.toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary Footer Box */}
              <div className="p-5 bg-slate-900 text-white rounded-3xl shadow-lg space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Venta</span>
                    <p className="text-xs text-slate-400">{totalItemsCount} unidades vendidas</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black font-mono text-emerald-400">
                      ${totalAmount.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleConfirmSale}
                  disabled={isProcessing || cart.length === 0}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-2xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Registrando Venta en Firebase...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                      <span>CONFIRMAR VENTA (${totalAmount.toLocaleString('es-AR')})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* SCANNER MODAL OVERLAY */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-between p-4 animate-fadeIn">
          <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center space-y-4">
            <div className="flex items-center justify-between text-white px-2">
              <div className="flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Escáner de Ventas</h3>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <BarcodeScanner
              onScanSuccess={(scannedCode) => {
                handleBarcodeScanned(scannedCode);
                setIsScannerOpen(false);
              }}
              isScanningActive={isScannerOpen}
            />

            <button
              onClick={() => setIsScannerOpen(false)}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Volver al Carrito
            </button>
          </div>
        </div>
      )}

      {/* MANUAL SEARCH CATALOG MODAL OVERLAY */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Agregar Producto Manualmente</h3>
              </div>
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchTerm('');
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                autoFocus
                placeholder="Buscar por nombre, marca o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {searchResults.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">
                  No se encontraron productos coincidentes.
                </p>
              ) : (
                searchResults.map((product) => {
                  const stock = product.stockQuantity || 0;
                  return (
                    <div
                      key={product.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{product.name}</h4>
                        <p className="text-[10px] text-slate-500">
                          {product.brand} | EAN: {product.barcode}
                        </p>
                        <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                          Precio hab: ${product.salePrice ? product.salePrice.toLocaleString('es-AR') : 'Sin definir'}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          handleAddProductToCart(product);
                          setIsSearchOpen(false);
                        }}
                        disabled={stock <= 0}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                          stock <= 0
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{stock <= 0 ? 'Sin Stock' : 'Agregar'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
