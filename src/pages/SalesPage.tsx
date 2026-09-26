import React, { useState, useEffect, useCallback } from 'react';
import { Product, getProductStock } from '../types/product';
import { CartItem, SaleRecord, PaymentMethod } from '../types/sale';
import { Customer, CreateCustomerInput } from '../types/customer';
import { productService } from '../services/firebase/productService';
import { salesService } from '../services/firebase/salesService';
import { customerService } from '../services/firebase/customerService';
import { accountService } from '../services/firebase/accountService';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { CustomerFormModal } from '../components/customer/CustomerFormModal';
import { ProductSearch } from '../components/sales/ProductSearch';
import { NumericInput } from '../components/common/NumericInput';
import { playScanSound } from '../utils/audio';
import { useLocation } from '../context/LocationContext';
import { getLocationName } from '../types/location';
import { SalesHistoryModal } from '../components/modals/SalesHistoryModal';
import { SaleDetailModal } from '../components/modals/SaleDetailModal';
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
  CreditCard,
  Users,
  UserCheck,
  UserPlus,
  QrCode,
  Banknote,
  Building2,
  ArrowLeftRight,
  MapPin,
  History,
  Receipt
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
  const { activeLocation } = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Payment method & Customer selection state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [customerBalances, setCustomerBalances] = useState<Record<string, number>>({});
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Combined Payment Breakdown State
  const [splitCashStr, setSplitCashStr] = useState<string>('');
  const [splitMpStr, setSplitMpStr] = useState<string>('');
  const [splitTransferStr, setSplitTransferStr] = useState<string>('');
  const [splitCreditStr, setSplitCreditStr] = useState<string>('');

  // Status & Feedback banners
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null);
  const [showSalesHistory, setShowSalesHistory] = useState<boolean>(false);
  const [saleDetailToShow, setSaleDetailToShow] = useState<SaleRecord | null>(null);

  // Helper to clear feedback banner
  const clearFeedback = () => setFeedback(null);

  // Load customers when Fiado is chosen
  const loadCustomersData = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const [custList, balMap] = await Promise.all([
        customerService.getAllCustomers(),
        accountService.getAllBalances(activeLocation),
      ]);
      setCustomersList(custList);
      setCustomerBalances(balMap);
    } catch (err) {
      console.warn('Error al cargar clientes para venta fiada:', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, [activeLocation]);

  useEffect(() => {
    if (paymentMethod === 'credit' || paymentMethod === 'mixed') {
      loadCustomersData();
    }
  }, [paymentMethod, loadCustomersData]);

  // Handle inline creation of customer from sale
  const handleCreateCustomerFromSale = async (data: CreateCustomerInput) => {
    const created = await customerService.createCustomer(data);
    setSelectedCustomer(created);
    setShowCreateCustomerModal(false);
    await loadCustomersData();
    setFeedback({
      type: 'success',
      message: `Cliente '${created.name}' creado y seleccionado para la venta.`,
    });
  };

  // Add product to cart logic using location-specific stock
  const handleAddProductToCart = (product: Product) => {
    clearFeedback();

    const currentStock = getProductStock(product, activeLocation);

    // Rule: Out of stock at active location
    if (currentStock <= 0) {
      playScanSound('error');
      setFeedback({
        type: 'error',
        message: `El producto '${product.name}' no tiene stock disponible en ${getLocationName(activeLocation)} (Stock: 0).`,
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
        message: `Stock insuficiente en ${getLocationName(activeLocation)} para '${product.name}'. Disponible: ${currentStock} u., ya agregaste ${existingQty} al carrito.`,
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
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;

    try {
      const localMatch = products.find(
        (p) => p.barcode && p.barcode.trim().toLowerCase() === cleanBarcode.toLowerCase()
      );
      const found = localMatch || (await productService.getByBarcode(cleanBarcode));

      if (found) {
        handleAddProductToCart(found);
      } else {
        playScanSound('error');
        setFeedback({
          type: 'error',
          message: `Producto no encontrado para el código: ${cleanBarcode}`,
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
      const maxStock = getProductStock(item.product, activeLocation);

      if (newQty <= 0) {
        return prev.filter((i) => i.product.id !== productId);
      }

      if (newQty > maxStock) {
        setFeedback({
          type: 'warning',
          message: `Stock insuficiente en ${getLocationName(activeLocation)}. El máximo disponible para '${item.product.name}' es de ${maxStock} unidades.`,
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
    setSelectedCustomer(null);
    setPaymentMethod('cash');
    setSplitCashStr('');
    setSplitMpStr('');
    setSplitTransferStr('');
    setSplitCreditStr('');
    setFeedback(null);
  };

  // Totals calculations
  const totalAmount = cart.reduce((acc, curr) => acc + curr.subtotal, 0);
  const totalItemsCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  // Split payment math
  const splitCash = Math.max(0, parseFloat(splitCashStr) || 0);
  const splitMp = Math.max(0, parseFloat(splitMpStr) || 0);
  const splitTransfer = Math.max(0, parseFloat(splitTransferStr) || 0);
  const splitCredit = Math.max(0, parseFloat(splitCreditStr) || 0);

  const splitAssigned = Math.round((splitCash + splitMp + splitTransfer + splitCredit) * 100) / 100;
  const splitRemaining = Math.round((totalAmount - splitAssigned) * 100) / 100;
  const isSplitExact = Math.abs(splitRemaining) < 0.01;

  // Confirm Sale Execution with activeLocation
  const handleConfirmSale = async () => {
    if (cart.length === 0) return;
    clearFeedback();

    // Fiado validation
    if (paymentMethod === 'credit' && !selectedCustomer) {
      playScanSound('error');
      setFeedback({
        type: 'warning',
        message: 'Seleccioná o creá un cliente para continuar con la venta fiada.',
      });
      return;
    }

    // Mixed payment validation
    if (paymentMethod === 'mixed') {
      if (!isSplitExact) {
        playScanSound('error');
        setFeedback({
          type: 'warning',
          message: splitRemaining > 0
            ? `Faltan asignar $${splitRemaining.toLocaleString('es-AR')} del total de la venta.`
            : `El monto asignado supera el total por $${Math.abs(splitRemaining).toLocaleString('es-AR')}.`
        });
        return;
      }
      if (splitCredit > 0 && !selectedCustomer) {
        playScanSound('error');
        setFeedback({
          type: 'warning',
          message: 'Seleccioná o creá un cliente para el importe en fiado.',
        });
        return;
      }
    }

    setIsProcessing(true);

    try {
      const result = await salesService.processSale(
        cart,
        paymentMethod,
        selectedCustomer?.id,
        selectedCustomer?.name,
        activeLocation,
        paymentMethod === 'mixed' ? {
          cash: splitCash,
          mercado_pago: splitMp,
          transfer: splitTransfer,
          credit: splitCredit,
        } : undefined
      );
      onProductsUpdated(result.updatedProducts);
      setCompletedSale(result.sale);
      playScanSound('success');
      setCart([]);
      setSelectedCustomer(null);
      setPaymentMethod('cash');
      setSplitCashStr('');
      setSplitMpStr('');
      setSplitTransferStr('');
      setSplitCreditStr('');
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

  // Filtered customer search for Fiado selection
  const customerSearchResults = customerSearchTerm.trim()
    ? customersList.filter(
        (c) =>
          c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
          (c.phone && c.phone.toLowerCase().includes(customerSearchTerm.toLowerCase()))
      )
    : customersList;

  return (
    <div className="space-y-5 animate-fadeIn max-w-3xl mx-auto">
      {/* Top Header with Active Point of Sale Indicator */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Nueva Venta</h1>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                activeLocation === 'aimogasta' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
              }`}>
                <MapPin className="w-3 h-3" />
                {getLocationName(activeLocation)}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Punto de venta activo: {getLocationName(activeLocation)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSalesHistory(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Ver historial de ventas realizadas"
          >
            <History className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Historial</span>
          </button>

          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vaciar</span>
            </button>
          )}
        </div>
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

            <div className="flex justify-between text-xs text-slate-500 border-b pb-2 font-sans">
              <span>Forma de Pago:</span>
              <span className="font-bold text-slate-800 uppercase">
                {completedSale.paymentMethod === 'credit'
                  ? `Fiado (${completedSale.customerName || 'Cliente'})`
                  : completedSale.paymentMethod === 'mercado_pago'
                  ? 'Mercado Pago'
                  : completedSale.paymentMethod === 'transfer'
                  ? 'Transferencia'
                  : completedSale.paymentMethod === 'mixed'
                  ? 'Pago Combinado'
                  : 'Efectivo'}
              </span>
            </div>

            {completedSale.paymentMethod === 'mixed' && completedSale.paymentBreakdown && (
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1 text-xs font-sans">
                <span className="text-[10px] uppercase font-bold text-amber-900 block">Desglose del Pago:</span>
                {(completedSale.paymentBreakdown.cash || 0) > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>💵 Efectivo:</span>
                    <strong className="font-mono">${completedSale.paymentBreakdown.cash!.toLocaleString('es-AR')}</strong>
                  </div>
                )}
                {(completedSale.paymentBreakdown.mercado_pago || 0) > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>📱 Mercado Pago:</span>
                    <strong className="font-mono">${completedSale.paymentBreakdown.mercado_pago!.toLocaleString('es-AR')}</strong>
                  </div>
                )}
                {(completedSale.paymentBreakdown.transfer || 0) > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>🏦 Transferencia:</span>
                    <strong className="font-mono">${completedSale.paymentBreakdown.transfer!.toLocaleString('es-AR')}</strong>
                  </div>
                )}
                {(completedSale.paymentBreakdown.credit || 0) > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>📒 Fiado ({completedSale.customerName || 'Cliente'}):</span>
                    <strong className="font-mono text-purple-700">${completedSale.paymentBreakdown.credit!.toLocaleString('es-AR')}</strong>
                  </div>
                )}
              </div>
            )}

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

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={() => setSaleDetailToShow(completedSale)}
              className="w-full sm:w-1/2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-1.5"
            >
              <Receipt className="w-4 h-4 text-emerald-600" />
              Ver Detalle / Ticket
            </button>
            <button
              onClick={() => setCompletedSale(null)}
              className="w-full sm:w-1/2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Nueva Venta
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Action Bar: Scan Button & Real-time Product Search */}
          <div className="bg-white p-4.5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-emerald-600" />
                <span>Agregar Producto a la Venta</span>
              </span>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-xs active:scale-98 transition-all flex items-center gap-1.5 shrink-0"
              >
                <ScanLine className="w-4 h-4 stroke-[2.2]" />
                <span>📷 ESCANEAR PRODUCTO</span>
              </button>
            </div>

            {/* Real-time Search Component with USB Barcode Scanner Support */}
            <ProductSearch
              products={products}
              onSelectProduct={handleAddProductToCart}
              onBarcodeNotFound={handleBarcodeScanned}
              locationId={activeLocation}
              autoFocus={true}
              showScannerIndicator={true}
              placeholder="🔎 Buscar o escanear por nombre, marca, presentación o EAN..."
            />
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
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                ) : feedback.type === 'warning' ? (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
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
            <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-2xs">
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
                    className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3 relative"
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
                          <NumericInput
                            min="1"
                            max={item.product.stockQuantity || 1}
                            allowDecimal={false}
                            value={item.quantity}
                            onChangeValue={(val) => handleUpdateQuantity(item.product.id, val || 1)}
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
                          <NumericInput
                            min="0"
                            step="any"
                            allowDecimal={true}
                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                            placeholder="0"
                            onChangeRaw={(e) => handleUpdateUnitPrice(item.product.id, e.target.value)}
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

              {/* FORMA DE PAGO SECTION */}
              <div className="p-4 bg-white border border-slate-200 rounded-3xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Forma de Pago</h3>
                  {paymentMethod === 'mixed' && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Múltiples Medios
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setSelectedCustomer(null);
                    }}
                    className={`py-3 px-2 rounded-2xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 border ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('mercado_pago');
                      setSelectedCustomer(null);
                    }}
                    className={`py-3 px-2 rounded-2xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 border ${
                      paymentMethod === 'mercado_pago'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Mercado Pago</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('transfer');
                      setSelectedCustomer(null);
                    }}
                    className={`py-3 px-2 rounded-2xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 border ${
                      paymentMethod === 'transfer'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Transferencia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`py-3 px-2 rounded-2xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 border ${
                      paymentMethod === 'credit'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Fiado (Cuenta)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mixed')}
                    className={`col-span-2 sm:col-span-1 py-3 px-2 rounded-2xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 border ${
                      paymentMethod === 'mixed'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-400/40'
                        : 'bg-amber-50/70 text-amber-900 border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Pago Combinado</span>
                  </button>
                </div>

                {/* INTERFAZ DE PAGO COMBINADO */}
                {paymentMethod === 'mixed' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3.5 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                          <span>Distribución del Total</span>
                        </span>
                        <p className="text-[11px] text-slate-500">Ingresá los importes cobrados por cada medio.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Total de la venta</span>
                        <span className="text-base font-black font-mono text-slate-900">${totalAmount.toLocaleString('es-AR')}</span>
                      </div>
                    </div>

                    {/* Inputs de medios combinados */}
                    <div className="space-y-2">
                      {/* Efectivo */}
                      <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                            <Banknote className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">Efectivo</span>
                            <span className="text-[10px] text-slate-400 block">Dinero en caja</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="relative w-full sm:w-36">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={splitCashStr}
                              onChange={(e) => setSplitCashStr(e.target.value)}
                              className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                          {splitRemaining > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = Math.round((splitCash + splitRemaining) * 100) / 100;
                                setSplitCashStr(nextVal.toString());
                              }}
                              className="px-2 py-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl whitespace-nowrap transition-colors"
                              title="Asignar el saldo restante aquí"
                            >
                              Restante
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mercado Pago */}
                      <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                            <QrCode className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">Mercado Pago</span>
                            <span className="text-[10px] text-slate-400 block">Cobro digital MP</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="relative w-full sm:w-36">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={splitMpStr}
                              onChange={(e) => setSplitMpStr(e.target.value)}
                              className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                          {splitRemaining > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = Math.round((splitMp + splitRemaining) * 100) / 100;
                                setSplitMpStr(nextVal.toString());
                              }}
                              className="px-2 py-2 text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl whitespace-nowrap transition-colors"
                              title="Asignar el saldo restante aquí"
                            >
                              Restante
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Transferencia */}
                      <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">Transferencia</span>
                            <span className="text-[10px] text-slate-400 block">Banco / Cuenta digital</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="relative w-full sm:w-36">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={splitTransferStr}
                              onChange={(e) => setSplitTransferStr(e.target.value)}
                              className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          {splitRemaining > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = Math.round((splitTransfer + splitRemaining) * 100) / 100;
                                setSplitTransferStr(nextVal.toString());
                              }}
                              className="px-2 py-2 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl whitespace-nowrap transition-colors"
                              title="Asignar el saldo restante aquí"
                            >
                              Restante
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Fiado / Cuenta Corriente */}
                      <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">Fiado (Cuenta Corriente)</span>
                            <span className="text-[10px] text-slate-400 block">Anotar en cuenta de cliente</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="relative w-full sm:w-36">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={splitCreditStr}
                              onChange={(e) => setSplitCreditStr(e.target.value)}
                              className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          {splitRemaining > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = Math.round((splitCredit + splitRemaining) * 100) / 100;
                                setSplitCreditStr(nextVal.toString());
                              }}
                              className="px-2 py-2 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl whitespace-nowrap transition-colors"
                              title="Asignar el saldo restante aquí"
                            >
                              Restante
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Resumen de Asignación y Alerta de Validación Obligatoria */}
                    <div className="p-3.5 rounded-2xl border text-xs space-y-2 bg-slate-50 border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-bold">TOTAL ASIGNADO:</span>
                        <span className="font-mono font-black text-slate-900">${splitAssigned.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-bold">RESTANTE:</span>
                        <span className={`font-mono font-black ${isSplitExact ? 'text-emerald-700' : splitRemaining > 0 ? 'text-amber-700' : 'text-rose-700'}`}>
                          ${splitRemaining.toLocaleString('es-AR')}
                        </span>
                      </div>

                      {splitRemaining > 0.009 && (
                        <div className="p-2.5 bg-amber-100/80 border border-amber-300 rounded-xl text-amber-950 font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Faltan asignar ${splitRemaining.toLocaleString('es-AR')}</span>
                        </div>
                      )}

                      {splitRemaining < -0.009 && (
                        <div className="p-2.5 bg-rose-100/80 border border-rose-300 rounded-xl text-rose-950 font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                          <span>El monto asignado supera el total por ${Math.abs(splitRemaining).toLocaleString('es-AR')}</span>
                        </div>
                      )}

                      {isSplitExact && splitAssigned > 0 && (
                        <div className="p-2.5 bg-emerald-100/80 border border-emerald-300 rounded-xl text-emerald-950 font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Monto total asignado exactamente. Venta lista para confirmar.</span>
                        </div>
                      )}
                    </div>

                    {/* Selección de Cliente para la parte en Fiado */}
                    {splitCredit > 0 && (
                      <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-purple-600" />
                            <span>Cliente para Parte Fiada (${splitCredit.toLocaleString('es-AR')})</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => setShowCreateCustomerModal(true)}
                            className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-white hover:bg-purple-100 rounded-xl border border-purple-200 transition-colors flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ Crear nuevo</span>
                          </button>
                        </div>

                        {selectedCustomer ? (
                          <div className="p-3 bg-white border border-purple-200 rounded-xl flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold">
                                <UserCheck className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-purple-950">{selectedCustomer.name}</p>
                                <p className="text-[11px] text-purple-700 font-mono">
                                  Saldo actual: ${(customerBalances[selectedCustomer.id] || 0).toLocaleString('es-AR')}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(null)}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-300 rounded-xl"
                            >
                              Cambiar
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                              <input
                                type="text"
                                placeholder="Buscar cliente por nombre o teléfono..."
                                value={customerSearchTerm}
                                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                              />
                            </div>

                            {loadingCustomers ? (
                              <div className="p-2 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                                <span>Cargando clientes...</span>
                              </div>
                            ) : customerSearchResults.length === 0 ? (
                              <div className="p-3 bg-white rounded-xl text-center space-y-1.5 border border-purple-100">
                                <p className="text-xs text-slate-500">No se encontraron clientes.</p>
                                <button
                                  type="button"
                                  onClick={() => setShowCreateCustomerModal(true)}
                                  className="px-2.5 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg shadow-xs"
                                >
                                  + Crear cliente '{customerSearchTerm}'
                                </button>
                              </div>
                            ) : (
                              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                {customerSearchResults.map((cust) => {
                                  const bal = customerBalances[cust.id] || 0;
                                  return (
                                    <button
                                      key={cust.id}
                                      type="button"
                                      onClick={() => setSelectedCustomer(cust)}
                                      className="w-full p-2 bg-white hover:bg-purple-100/70 border border-slate-200 rounded-xl text-left flex items-center justify-between text-xs transition-colors"
                                    >
                                      <div>
                                        <p className="font-bold text-slate-900">{cust.name}</p>
                                        {cust.phone && <p className="text-[10px] text-slate-400">{cust.phone}</p>}
                                      </div>
                                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${bal > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                        {bal > 0 ? `Deuda: $${bal.toLocaleString('es-AR')}` : 'Sin deuda'}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* FIADO CUSTOMER SELECTOR (Venta puramente fiada) */}
                {paymentMethod === 'credit' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span>Seleccionar Cliente para Venta Fiada</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowCreateCustomerModal(true)}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Crear nuevo</span>
                      </button>
                    </div>

                    {selectedCustomer ? (
                      /* Selected Customer Badge Card */
                      <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-indigo-950">{selectedCustomer.name}</p>
                            <p className="text-[11px] text-indigo-700 font-mono">
                              Saldo actual:{' '}
                              <span className="font-bold">
                                ${(customerBalances[selectedCustomer.id] || 0).toLocaleString('es-AR')}
                              </span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      /* Search & Select Customer Dropdown list */
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          <input
                            type="text"
                            placeholder="Buscar cliente por nombre o teléfono..."
                            value={customerSearchTerm}
                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>

                        {loadingCustomers ? (
                          <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                            <span>Cargando lista de clientes...</span>
                          </div>
                        ) : customerSearchResults.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-2xl text-center space-y-2">
                            <p className="text-xs text-slate-500">No se encontraron clientes con ese nombre.</p>
                            <button
                              type="button"
                              onClick={() => setShowCreateCustomerModal(true)}
                              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs"
                            >
                              + Crear cliente '{customerSearchTerm}'
                            </button>
                          </div>
                        ) : (
                          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                            {customerSearchResults.map((cust) => {
                              const bal = customerBalances[cust.id] || 0;
                              return (
                                <button
                                  key={cust.id}
                                  type="button"
                                  onClick={() => setSelectedCustomer(cust)}
                                  className="w-full p-2.5 bg-slate-50 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-200 rounded-xl text-left flex items-center justify-between transition-colors"
                                >
                                  <div>
                                    <p className="text-xs font-bold text-slate-900">{cust.name}</p>
                                    {cust.phone && <p className="text-[10px] text-slate-500">{cust.phone}</p>}
                                  </div>
                                  <span
                                    className={`text-[10px] font-extrabold font-mono px-2 py-0.5 rounded-md ${
                                      bal > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {bal > 0 ? `Deuda: $${bal.toLocaleString('es-AR')}` : 'Sin deuda'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                  disabled={
                    isProcessing || 
                    cart.length === 0 || 
                    (paymentMethod === 'mixed' && (!isSplitExact || (splitCredit > 0 && !selectedCustomer))) ||
                    (paymentMethod === 'credit' && !selectedCustomer)
                  }
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-2xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Registrando Venta en Firebase...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                      <span>
                        {paymentMethod === 'credit'
                          ? `CONFIRMAR VENTA FIADA (${selectedCustomer?.name || 'Seleccionar cliente'})`
                          : paymentMethod === 'mixed'
                          ? !isSplitExact
                            ? splitRemaining > 0 
                              ? `FALTAN ASIGNAR $${splitRemaining.toLocaleString('es-AR')}`
                              : `MONTO SUPERA EL TOTAL POR $${Math.abs(splitRemaining).toLocaleString('es-AR')}`
                            : splitCredit > 0 && !selectedCustomer
                            ? 'SELECCIONÁ UN CLIENTE PARA EL FIADO'
                            : `CONFIRMAR VENTA COMBINADA ($${totalAmount.toLocaleString('es-AR')})`
                          : `CONFIRMAR VENTA ($${totalAmount.toLocaleString('es-AR')})`}
                      </span>
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



      {/* INLINE CREATE CUSTOMER MODAL */}
      {showCreateCustomerModal && (
        <CustomerFormModal
          isEditing={false}
          title="Crear Cliente para Venta Fiada"
          onSubmit={handleCreateCustomerFromSale}
          onCancel={() => setShowCreateCustomerModal(false)}
        />
      )}

      {/* SALES HISTORY MODAL */}
      {showSalesHistory && (
        <SalesHistoryModal
          isOpen={showSalesHistory}
          onClose={() => setShowSalesHistory(false)}
          onSaleCancelled={async () => {
            try {
              const updated = await productService.getAllProducts();
              onProductsUpdated(updated);
              loadCustomersData();
            } catch (err) {
              console.error('Error actualizando productos tras anulación:', err);
            }
          }}
        />
      )}

      {/* SALE DETAIL MODAL */}
      {saleDetailToShow && (
        <SaleDetailModal
          sale={saleDetailToShow}
          onClose={() => setSaleDetailToShow(null)}
          onOperationCancelled={async () => {
            try {
              const updated = await productService.getAllProducts();
              onProductsUpdated(updated);
              loadCustomersData();
            } catch (err) {
              console.error('Error actualizando productos tras anulación:', err);
            }
          }}
        />
      )}
    </div>
  );
};
