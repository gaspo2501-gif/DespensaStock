import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Store, 
  Phone, 
  FileText, 
  DollarSign, 
  ShoppingCart, 
  Receipt, 
  Calendar, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Clock, 
  Building2, 
  Wallet, 
  CreditCard,
  Ban
} from 'lucide-react';
import { Provider, SupplierPayment } from '../../types/provider';
import { Purchase } from '../../types/purchase';
import { providerService } from '../../services/firebase/providerService';
import { SupplierPaymentModal } from './SupplierPaymentModal';
import { PurchaseDetailModal } from '../modals/PurchaseDetailModal';
import { formatLocalDate } from '../../utils/dateUtils';

interface ProviderAccountModalProps {
  providerId: string;
  onClose: () => void;
  onPurchaseClick?: (purchaseId: string) => void;
  onNewPurchase?: (provider: Provider) => void;
}

export const ProviderAccountModal: React.FC<ProviderAccountModalProps> = ({
  providerId,
  onClose,
  onPurchaseClick,
  onNewPurchase,
}) => {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [totalPurchased, setTotalPurchased] = useState<number>(0);
  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [currentDebt, setCurrentDebt] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'purchases' | 'payments'>('purchases');

  // Modal sub-states
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<Purchase | null>(null);
  const [selectedPurchaseIdForDetail, setSelectedPurchaseIdForDetail] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      const data = await providerService.getProviderAccount(providerId);
      setProvider(data.provider);
      setPurchases(data.purchases);
      setPayments(data.payments);
      setTotalPurchased(data.totalPurchased);
      setTotalPaid(data.totalPaid);
      setCurrentDebt(data.currentDebt);
    } catch (err) {
      console.warn('Error loading provider account:', err);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleOpenPayment = (purchase?: Purchase) => {
    setSelectedPurchaseForPayment(purchase || null);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    loadAccount();
  };

  const renderPaymentSourceBadge = (source: string) => {
    switch (source) {
      case 'caja_diaria':
        return (
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
            <Wallet className="w-2.5 h-2.5 text-emerald-600" /> Caja Diaria
          </span>
        );
      case 'caja_general':
        return (
          <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
            <Building2 className="w-2.5 h-2.5 text-indigo-600" /> Caja General
          </span>
        );
      case 'mercado_pago':
        return (
          <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
            Mercado Pago
          </span>
        );
      case 'transfer':
        return (
          <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
            Transferencia
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            {source}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black truncate max-w-xs sm:max-w-md">
                  {provider?.name || 'Proveedor'}
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Cuenta corriente y trazabilidad comercial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenPayment()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Registrar Pago</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Financial KPI Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {/* Total Comprado */}
          <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              Total Comprado
            </span>
            <span className="font-mono text-xl font-black text-slate-900">
              ${totalPurchased.toLocaleString('es-AR')}
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">{purchases.length} compra(s) registradas</p>
          </div>

          {/* Total Pagado */}
          <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              Total Pagado
            </span>
            <span className="font-mono text-xl font-black text-emerald-700">
              ${totalPaid.toLocaleString('es-AR')}
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">{payments.length} pago(s) realizados</p>
          </div>

          {/* Saldo Pendiente / Deuda */}
          <div className={`p-3 rounded-2xl border shadow-2xs ${
            currentDebt > 0 
              ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          }`}>
            <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75">
              Saldo Pendiente (Deuda)
            </span>
            <span className={`font-mono text-xl font-black ${
              currentDebt > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}>
              ${currentDebt.toLocaleString('es-AR')}
            </span>
            <p className="text-[10px] mt-0.5 opacity-80">
              {currentDebt > 0 ? 'Monto a favor del proveedor' : 'Cuenta al día (sin deuda)'}
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex gap-4 text-xs font-bold">
            <button
              onClick={() => setActiveTab('purchases')}
              className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'purchases'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Compras de Mercadería ({purchases.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'payments'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Pagos Realizados ({payments.length})</span>
            </button>
          </div>

          {provider && onNewPurchase && (
            <button
              onClick={() => onNewPurchase(provider)}
              className="mb-2 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Compra</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs">Cargando cuenta corriente...</p>
            </div>
          ) : activeTab === 'purchases' ? (
            purchases.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShoppingCart className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">No hay compras registradas para este proveedor.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {purchases.map((p) => {
                  const pending = p.pendingAmount !== undefined ? p.pendingAmount : (p.totalAmount || 0) - (p.paidAmount || 0);
                  const isPaid = pending <= 0.01;

                  return (
                    <div
                      key={p.id}
                      className="p-3.5 bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl shadow-2xs flex items-center justify-between gap-3 transition-all"
                    >
                      <div 
                        onClick={() => {
                          if (onPurchaseClick) onPurchaseClick(p.id);
                          else setSelectedPurchaseIdForDetail(p.id);
                        }}
                        className="space-y-1 min-w-0 cursor-pointer flex-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            Compra #{p.id.slice(-6)}
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.2 rounded-full ${
                            isPaid 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : p.paidAmount && p.paidAmount > 0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {isPaid ? 'PAGADA' : p.paidAmount && p.paidAmount > 0 ? 'PAGO PARCIAL' : 'PENDIENTE'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {p.date || formatLocalDate(p.createdAt)}
                          </span>
                          <span>•</span>
                          <span>{p.totalItemsCount || p.items?.length || 0} unidades</span>
                          {p.paidFrom && (
                            <>
                              <span>•</span>
                              <span>Medio: {p.paidFrom === 'caja_general' ? 'Caja General' : p.paidFrom === 'mercado_pago' ? 'MP' : p.paidFrom === 'transfer' ? 'Transfer' : 'Caja Diaria'}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <span className="font-mono font-black text-sm text-slate-900 block">
                            ${(p.totalAmount || 0).toLocaleString('es-AR')}
                          </span>
                          {!isPaid ? (
                            <span className="text-[10px] font-bold text-rose-600 block">
                              Resta: ${pending.toLocaleString('es-AR')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 block">
                              Totalmente abonada
                            </span>
                          )}
                        </div>

                        {!isPaid && (
                          <button
                            onClick={() => handleOpenPayment(p)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors"
                            title="Abonar saldo pendiente de esta compra"
                          >
                            Pagar
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (onPurchaseClick) onPurchaseClick(p.id);
                            else setSelectedPurchaseIdForDetail(p.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            payments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">No hay pagos registrados para este proveedor.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {pay.notes || 'Pago a proveedor'}
                        </span>
                        {pay.purchaseId && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            Compra #{pay.purchaseId.slice(-6)}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>{pay.date || formatLocalDate(pay.createdAt)}</span>
                        <span>•</span>
                        {renderPaymentSourceBadge(pay.paidFrom)}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-sm text-emerald-700 block">
                        +${pay.amount.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {provider?.phone ? `Contacto: ${provider.phone}` : 'Despensa Stock • Proveedores'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            Cerrar
          </button>
        </div>

        {/* Modals */}
        {showPaymentModal && provider && (
          <SupplierPaymentModal
            providerId={provider.id}
            providerName={provider.name}
            purchaseId={selectedPurchaseForPayment?.id}
            pendingAmount={selectedPurchaseForPayment?.pendingAmount}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedPurchaseForPayment(null);
            }}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}

        {selectedPurchaseIdForDetail && (
          <PurchaseDetailModal
            purchaseId={selectedPurchaseIdForDetail}
            onClose={() => setSelectedPurchaseIdForDetail(null)}
            onOperationCancelled={loadAccount}
          />
        )}
      </div>
    </div>
  );
};
