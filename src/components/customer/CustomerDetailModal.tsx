import React, { useState, useEffect, useCallback } from 'react';
import { Customer } from '../../types/customer';
import { AccountMovement } from '../../types/account';
import { SaleRecord } from '../../types/sale';
import { accountService } from '../../services/firebase/accountService';
import { salesService } from '../../services/firebase/salesService';
import { PaymentFormModal } from './PaymentFormModal';
import { SaleDetailModal } from '../modals/SaleDetailModal';
import { PaymentDetailModal } from '../modals/PaymentDetailModal';
import { 
  User, 
  Phone, 
  FileText, 
  DollarSign, 
  Receipt, 
  History, 
  X, 
  Loader2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface CustomerDetailModalProps {
  customer: Customer;
  onClose: () => void;
  onEditCustomer: (customer: Customer) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  onClose,
  onEditCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'sales'>('account');
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedPaymentMovement, setSelectedPaymentMovement] = useState<AccountMovement | null>(null);

  // Load customer data: movements and balance
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [movsList, currentBal, allSales] = await Promise.all([
        accountService.getCustomerMovements(customer.id),
        accountService.getCustomerBalance(customer.id),
        salesService.getRecentSales(),
      ]);

      setMovements(movsList);
      setBalance(currentBal);
      const customerSales = allSales.filter(
        (s) => s.customerId === customer.id || (s.paymentMethod === 'credit' && s.customerId === customer.id)
      );
      setSales(customerSales);
    } catch (err) {
      console.error('Error al cargar ficha del cliente:', err);
    } finally {
      setLoading(false);
    }
  }, [customer.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegisterPaymentSubmit = async (
    amount: number, 
    notes?: string, 
    paymentMethod: 'cash' | 'mercado_pago' | 'transfer' | 'other' = 'cash'
  ) => {
    await accountService.registerPayment(customer.id, amount, notes, paymentMethod);
    setShowPaymentModal(false);
    await loadData();
  };

  // Compute running balance array for chronological movements display
  // We sort movements chronologically ascending to compute running balances, then display descending
  const computedMovements = React.useMemo(() => {
    const sortedAsc = [...movements].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let current = 0;
    const withRunning = sortedAsc.map((mov) => {
      if (mov.status !== 'CANCELLED') {
        if (mov.type === 'DEBT') {
          current += mov.amount;
        } else {
          current -= mov.amount;
        }
      }
      return {
        ...mov,
        runningBalance: Math.max(0, current),
      };
    });

    return withRunning.reverse();
  }, [movements]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[88dvh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">{customer.name}</h2>
              {customer.phone ? (
                <p className="text-xs text-slate-300 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>{customer.phone}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400">Sin teléfono registrado</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditCustomer(customer)}
              className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              Editar
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Debt Status Card Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Estado de Cuenta</span>
            <div className="flex items-center gap-2 mt-0.5">
              {balance > 0 ? (
                <span className="text-2xl font-black font-mono text-rose-600">
                  ${balance.toLocaleString('es-AR')}
                </span>
              ) : (
                <span className="text-xl font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Sin Deuda
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={balance <= 0}
            className={`w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md ${
              balance > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Registrar Pago</span>
          </button>
        </div>

        {/* Tab Selector Bar */}
        <div className="flex border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-2 border-b-2 ${
              activeTab === 'account'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Cuenta Corriente ({computedMovements.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-2 border-b-2 ${
              activeTab === 'sales'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Ventas Fiadas ({sales.length})</span>
          </button>
        </div>

        {/* Scrollable Modal Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Cargando datos del cliente...</p>
            </div>
          ) : activeTab === 'account' ? (
            /* Cuenta Corriente Movements Log */
            computedMovements.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <History className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Sin movimientos registrados</p>
                <p className="text-xs text-slate-400">Este cliente aún no registra ventas fiadas ni pagos.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {computedMovements.map((mov) => {
                  const isDebt = mov.type === 'DEBT';
                  const dateFormatted = new Date(mov.createdAt).toLocaleString('es-AR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });

                  const handleClickMovement = () => {
                    if (isDebt) {
                      if (mov.saleId) {
                        setSelectedSaleId(mov.saleId);
                      } else {
                        // Attempt to match sale by amount or timestamp
                        const matchedSale = sales.find((s) => Math.abs(s.totalAmount - mov.amount) < 0.01);
                        if (matchedSale) {
                          setSelectedSale(matchedSale);
                        }
                      }
                    } else {
                      setSelectedPaymentMovement(mov);
                    }
                  };

                  const canOpenSale = isDebt && (mov.saleId || sales.some((s) => Math.abs(s.totalAmount - mov.amount) < 0.01));

                  const isCancelled = mov.status === 'CANCELLED';

                  return (
                    <div
                      key={mov.id}
                      onClick={handleClickMovement}
                      className={`p-3.5 border rounded-2xl flex items-center justify-between gap-3 shadow-2xs cursor-pointer transition-all group ${
                        isCancelled
                          ? 'bg-rose-50/40 border-rose-200/80 opacity-80'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                      title={isDebt ? (canOpenSale ? 'Hacer clic para ver detalle de la venta' : 'Venta fiada') : 'Hacer clic para ver comprobante del pago'}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                            isCancelled
                              ? 'bg-slate-400'
                              : isDebt ? 'bg-rose-500' : 'bg-emerald-600'
                          }`}
                        >
                          {isDebt ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isCancelled ? (
                              <span className="text-[10px] font-black text-rose-700 bg-rose-100/70 border border-rose-200 px-2 py-0.5 rounded-full">
                                ANULADO
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                  isDebt
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {isDebt ? 'Deuda Fiada' : 'Pago Recibido'}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 font-mono">{dateFormatted}</span>
                            {isDebt && canOpenSale && (
                              <span className="text-[10px] text-purple-600 font-bold group-hover:underline flex items-center gap-0.5">
                                <span>Ver venta</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            )}
                            {!isDebt && (
                              <span className="text-[10px] text-emerald-600 font-bold group-hover:underline flex items-center gap-0.5">
                                <span>Ver pago</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <p className={`text-xs font-bold mt-1 truncate ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {mov.description || (isDebt ? 'Venta fiada' : 'Pago a cuenta')}
                          </p>
                          {mov.notes && <p className="text-[11px] text-slate-500 italic truncate">{mov.notes}</p>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black font-mono ${
                          isCancelled
                            ? 'text-slate-400 line-through'
                            : isDebt ? 'text-rose-600' : 'text-emerald-700'
                        }`}>
                          {isDebt ? '+' : '-'}${mov.amount.toLocaleString('es-AR')}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Saldo: ${mov.runningBalance.toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Ventas Fiadas Log */
            sales.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Sin ventas fiadas registradas</p>
                <p className="text-xs text-slate-400">Las ventas fiadas asociadas a este cliente aparecerán aquí.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sales.map((sale) => {
                  const isSaleCancelled = sale.status === 'CANCELLED';
                  const dateFormatted = new Date(sale.createdAt).toLocaleString('es-AR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });

                  return (
                    <div
                      key={sale.id}
                      className={`p-4 border rounded-2xl shadow-2xs space-y-2 transition-colors cursor-pointer ${
                        isSaleCancelled
                          ? 'bg-rose-50/40 border-rose-200/80 opacity-80'
                          : 'bg-white border-slate-200 hover:bg-slate-50/50'
                      }`}
                      onClick={() => setSelectedSale(sale)}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold ${isSaleCancelled ? 'text-rose-900 line-through' : 'text-slate-700'}`}>
                            {sale.id}
                          </span>
                          {isSaleCancelled && (
                            <span className="text-[10px] font-black text-rose-700 bg-rose-100/70 border border-rose-200 px-2 py-0.5 rounded-full">
                              ANULADO
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">{dateFormatted}</span>
                        </div>
                        <span className={`text-xs font-black font-mono ${isSaleCancelled ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                          ${sale.totalAmount.toLocaleString('es-AR')}
                        </span>
                      </div>

                      <div className="text-xs space-y-1 text-slate-600">
                        {sale.items.map((item, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="truncate max-w-[240px]">
                              {item.quantity}× {item.name}
                            </span>
                            <span className="font-mono text-slate-800">${item.subtotal.toLocaleString('es-AR')}</span>
                          </div>
                        ))}
                      </div>

                      <p className="text-[10px] font-bold text-emerald-700 pt-1 text-right">Ver detalle de ticket →</p>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Nested Modal for Payment Registration */}
      {showPaymentModal && (
        <PaymentFormModal
          customer={customer}
          pendingDebt={balance}
          onSubmit={handleRegisterPaymentSubmit}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}

      {/* Modal for Sale Detail */}
      {(selectedSale || selectedSaleId) && (
        <SaleDetailModal
          sale={selectedSale}
          saleId={selectedSaleId}
          onClose={() => {
            setSelectedSale(null);
            setSelectedSaleId(null);
          }}
          onOperationCancelled={loadData}
        />
      )}

      {/* Modal for Payment Detail */}
      {selectedPaymentMovement && (
        <PaymentDetailModal
          movement={selectedPaymentMovement}
          customerName={customer.name}
          onClose={() => setSelectedPaymentMovement(null)}
          onOperationCancelled={loadData}
        />
      )}
    </div>
  );
};
