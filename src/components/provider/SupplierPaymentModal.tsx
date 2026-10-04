import React, { useState } from 'react';
import { 
  X, 
  DollarSign, 
  Building2, 
  Calendar, 
  Check, 
  Loader2, 
  AlertCircle, 
  Wallet, 
  FileText,
  ShieldCheck
} from 'lucide-react';
import { SupplierPaymentSource, SupplierPayment } from '../../types/provider';
import { providerService } from '../../services/firebase/providerService';
import { NumericInput } from '../common/NumericInput';
import { getArgentinaToday } from '../../utils/dateUtils';
import { useLocation } from '../../context/LocationContext';

interface SupplierPaymentModalProps {
  providerId: string;
  providerName: string;
  purchaseId?: string;
  pendingAmount?: number;
  onClose: () => void;
  onPaymentSuccess?: (payment: SupplierPayment) => void;
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({
  providerId,
  providerName,
  purchaseId,
  pendingAmount,
  onClose,
  onPaymentSuccess,
}) => {
  const { activeLocation } = useLocation();
  const [amount, setAmount] = useState<number>(pendingAmount && pendingAmount > 0 ? pendingAmount : 0);
  const [paidFrom, setPaidFrom] = useState<SupplierPaymentSource>('caja_diaria');
  const [date, setDate] = useState<string>(getArgentinaToday());
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setError('Ingresá un importe mayor a $0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payment = await providerService.registerSupplierPayment({
        providerId,
        providerName,
        purchaseId: purchaseId || undefined,
        amount,
        date,
        paidFrom,
        locationId: activeLocation,
        notes: notes.trim() || (purchaseId ? `Pago compra #${purchaseId.slice(-6)}` : 'Pago a cuenta de proveedor'),
      });

      onPaymentSuccess?.(payment);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar el pago al proveedor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">Registrar Pago a Proveedor</h3>
              <p className="text-xs text-indigo-200 truncate">{providerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Linked purchase hint if any */}
          {purchaseId && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs space-y-1">
              <div className="flex items-center justify-between text-indigo-900 font-bold">
                <span>Vinculado a Compra #{purchaseId.slice(-6)}</span>
                {pendingAmount !== undefined && (
                  <span className="font-mono text-indigo-700">
                    Saldo restante: ${pendingAmount.toLocaleString('es-AR')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-indigo-700">
                Este pago amortizará la deuda de este comprobante en la cuenta corriente.
              </p>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Monto a Pagar ($) *
              </label>
              {pendingAmount !== undefined && pendingAmount > 0 && amount !== pendingAmount && (
                <button
                  type="button"
                  onClick={() => setAmount(pendingAmount)}
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  Pagar total pendiente (${pendingAmount.toLocaleString('es-AR')})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 font-bold text-slate-400 font-mono text-base">$</span>
              <NumericInput
                min="0.01"
                step="any"
                allowDecimal={true}
                required
                autoFocus
                value={amount}
                onChangeValue={(val) => setAmount(val)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-lg font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Origin Fund / Paid From */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Origen del Dinero *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1 ${
                paidFrom === 'caja_diaria'
                  ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    Caja Diaria (Local)
                  </span>
                  <input
                    type="radio"
                    name="paidFrom"
                    value="caja_diaria"
                    checked={paidFrom === 'caja_diaria'}
                    onChange={() => setPaidFrom('caja_diaria')}
                    className="text-emerald-600"
                  />
                </div>
                <span className="text-[10px] text-slate-500">
                  Descuenta del efectivo físico en el cajón de hoy
                </span>
              </label>

              <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1 ${
                paidFrom === 'caja_general'
                  ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Caja General
                  </span>
                  <input
                    type="radio"
                    name="paidFrom"
                    value="caja_general"
                    checked={paidFrom === 'caja_general'}
                    onChange={() => setPaidFrom('caja_general')}
                    className="text-indigo-600"
                  />
                </div>
                <span className="text-[10px] text-slate-500">
                  Fondo acumulado del negocio (no altera el cajón físico)
                </span>
              </label>

              <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1 ${
                paidFrom === 'mercado_pago'
                  ? 'bg-sky-50/80 border-sky-400 ring-2 ring-sky-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    Mercado Pago
                  </span>
                  <input
                    type="radio"
                    name="paidFrom"
                    value="mercado_pago"
                    checked={paidFrom === 'mercado_pago'}
                    onChange={() => setPaidFrom('mercado_pago')}
                    className="text-sky-600"
                  />
                </div>
                <span className="text-[10px] text-slate-500">
                  Transferencia desde saldo Mercado Pago
                </span>
              </label>

              <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1 ${
                paidFrom === 'transfer'
                  ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    Transferencia Bancaria
                  </span>
                  <input
                    type="radio"
                    name="paidFrom"
                    value="transfer"
                    checked={paidFrom === 'transfer'}
                    onChange={() => setPaidFrom('transfer')}
                    className="text-purple-600"
                  />
                </div>
                <span className="text-[10px] text-slate-500">
                  Home banking / Transferencia directa
                </span>
              </label>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Fecha del Pago *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Notas / Comprobante / Nro. Transferencia (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Transferencia Santander #48291..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Anti-double accounting guarantee banner */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Control de Contabilidad Exacta</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Este pago cancela la deuda generada por la mercadería. <strong>NO genera un gasto operativo</strong> para evitar doble contabilización en los reportes de resultados.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando pago...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar Pago (${amount.toLocaleString('es-AR')})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
