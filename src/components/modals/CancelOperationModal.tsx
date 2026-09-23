import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert, 
  HelpCircle 
} from 'lucide-react';

export interface CancelOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title: string;
  operationId?: string;
  effects: string[];
  warningMessage?: string;
  confirmButtonText?: string;
}

const PREDEFINED_REASONS = [
  'Operación de prueba',
  'Error de carga',
  'Operación cancelada',
  'Duplicada',
  'Otro',
];

export const CancelOperationModal: React.FC<CancelOperationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  operationId,
  effects,
  warningMessage,
  confirmButtonText = 'Confirmar anulación',
}) => {
  if (!isOpen) return null;

  const [selectedReason, setSelectedReason] = useState<string>('Error de carga');
  const [customReason, setCustomReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    const finalReason = selectedReason === 'Otro' ? customReason.trim() : selectedReason;
    if (!finalReason) {
      setError('Por favor indique o detalle el motivo de la anulación.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm(finalReason);
      onClose();
    } catch (err: any) {
      console.error('Error durante la anulación:', err);
      setError(err?.message || 'Ocurrió un error al procesar la anulación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-rose-100 max-w-lg w-full flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-rose-950 leading-tight">
                {title}
              </h3>
              {operationId && (
                <p className="text-xs text-rose-700/80 font-mono font-bold mt-0.5">
                  ID: {operationId}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-white hover:bg-rose-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors disabled:opacity-50"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 font-medium animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-bold block">No se pudo anular:</span>
                {error}
              </div>
            </div>
          )}

          {warningMessage && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{warningMessage}</div>
            </div>
          )}

          {/* Effects box */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 space-y-2">
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
              Se revertirá automáticamente:
            </span>
            <ul className="space-y-1.5 text-xs text-slate-800 font-medium">
              {effects.map((eff, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{eff.startsWith('✓') ? eff.substring(1).trim() : eff}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60 mt-2">
              La operación permanecerá registrada como <strong className="text-rose-700">ANULADA</strong> para auditoría histórica.
            </p>
          </div>

          {/* Reason selection */}
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
              Motivo de la anulación:
            </label>
            <div className="space-y-2">
              {PREDEFINED_REASONS.map((r) => (
                <label 
                  key={r}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    selectedReason === r 
                      ? 'bg-rose-50/80 border-rose-300 text-rose-950 font-bold' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancellationReason"
                    value={r}
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                    className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs">{r}</span>
                </label>
              ))}
            </div>

            {selectedReason === 'Otro' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Escriba el motivo detallado..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || (selectedReason === 'Otro' && !customReason.trim())}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
