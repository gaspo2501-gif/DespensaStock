import React, { useState } from 'react';
import { Customer } from '../../types/customer';
import { NumericInput } from '../common/NumericInput';
import { DollarSign, FileText, X, Check, Loader2, AlertCircle } from 'lucide-react';

interface PaymentFormModalProps {
  customer: Customer;
  pendingDebt: number;
  onSubmit: (amount: number, notes?: string) => Promise<void>;
  onCancel: () => void;
}

export const PaymentFormModal: React.FC<PaymentFormModalProps> = ({
  customer,
  pendingDebt,
  onSubmit,
  onCancel,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      setError('Ingresá un importe mayor a $0.');
      return;
    }

    if (amount > pendingDebt) {
      setError(`El pago no puede superar la deuda pendiente ($${pendingDebt.toLocaleString('es-AR')}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(amount, notes.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[88dvh]">
        {/* Header */}
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Registrar Pago de Cliente</h3>
              <p className="text-[11px] text-emerald-100">{customer.name}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1.5 text-emerald-200 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Current Balance Card */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Deuda Pendiente Actual</p>
              <p className="text-xl font-black font-mono text-emerald-900 mt-0.5">
                ${pendingDebt.toLocaleString('es-AR')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAmountStr(pendingDebt.toString())}
              className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Pagar Total
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Importe a Pagar */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Importe Recibido ($) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">$</span>
              <NumericInput
                min="0.01"
                max={pendingDebt}
                step="any"
                allowDecimal={true}
                required
                autoFocus
                value={amountStr}
                onChangeRaw={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Observación / Comprobante <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Efectivo entregado en caja / Transferencia MP"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Actions Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar Pago</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
