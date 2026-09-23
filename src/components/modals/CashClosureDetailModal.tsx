import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  Calendar, 
  Building2, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  FileText,
  User,
  Scale,
  Ban
} from 'lucide-react';
import { CashClosure } from '../../types/cash';
import { getLocationName } from '../../types/location';
import { cashService } from '../../services/firebase/cashService';
import { CancelOperationModal } from './CancelOperationModal';
import { formatLocalDateTime, formatLocalDate } from '../../utils/dateUtils';

interface CashClosureDetailModalProps {
  closure?: CashClosure | null;
  onClose: () => void;
  onOperationCancelled?: () => void;
}

export const CashClosureDetailModal: React.FC<CashClosureDetailModalProps> = ({
  closure: initialClosure,
  onClose,
  onOperationCancelled,
}) => {
  if (!initialClosure) return null;

  const [closure, setClosure] = useState<CashClosure>(initialClosure);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialClosure) {
      setClosure(initialClosure);
    }
  }, [initialClosure]);

  const formatDate = (dateStr?: string, createdIso?: string) => {
    if (!dateStr && !createdIso) return 'Fecha no disponible';
    if (createdIso) return formatLocalDateTime(createdIso);
    return formatLocalDate(dateStr);
  };

  const extra = closure as any;
  const isExact = closure.difference === 0;
  const isSurplus = closure.difference > 0;
  const isShortage = closure.difference < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Detalle de Cierre de Caja</h3>
              <p className="text-xs text-slate-500 font-mono font-bold">
                {closure.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300/70 flex items-center justify-center text-slate-700 transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Cancellation Alert Banner */}
          {closure.status === 'CANCELLED' && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs animate-fadeIn">
              <div className="flex items-start gap-2.5 text-rose-800">
                <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="uppercase font-black text-[11px] block text-rose-950 tracking-wider">
                    Cierre de Caja Anulado
                  </span>
                  <p className="font-medium text-rose-900 mt-0.5">
                    Motivo: <span className="font-bold">{closure.cancellationReason || 'Sin motivo especificado'}</span>
                  </p>
                </div>
              </div>
              {closure.cancelledAt && (
                <span className="text-[10px] text-rose-600 font-mono font-bold bg-rose-100/60 px-2 py-1 rounded-lg shrink-0">
                  {formatDate(undefined, closure.cancelledAt)}
                </span>
              )}
            </div>
          )}

          {/* Difference Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            isExact
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : isSurplus
              ? 'bg-sky-50 border-sky-200 text-sky-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2.5">
              {isExact ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className={`w-6 h-6 shrink-0 ${isSurplus ? 'text-sky-600' : 'text-rose-600'}`} />
              )}
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider block">
                  {isExact ? 'Caja Cuadrada Exacta' : isSurplus ? 'Sobrante de Dinero' : 'Faltante de Dinero'}
                </span>
                <span className="text-xs font-semibold">
                  {isExact
                    ? 'El conteo físico coincidió con lo esperado'
                    : isSurplus
                    ? `Diferencia a favor de +$${closure.difference.toLocaleString('es-AR')}`
                    : `Diferencia en contra de -$${Math.abs(closure.difference).toLocaleString('es-AR')}`}
                </span>
              </div>
            </div>
            <span className={`text-lg font-black ${
              isExact ? 'text-emerald-800' : isSurplus ? 'text-sky-800' : 'text-rose-800'
            }`}>
              {isExact ? '$0' : isSurplus ? `+$${closure.difference.toLocaleString('es-AR')}` : `-$${Math.abs(closure.difference).toLocaleString('es-AR')}`}
            </span>
          </div>

          {/* Counts Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Efectivo Esperado</span>
              <p className="text-lg font-black text-slate-900 mt-1">
                ${(closure.expectedCash || 0).toLocaleString('es-AR')}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Efectivo Contado</span>
              <p className="text-lg font-black text-slate-900 mt-1">
                ${(closure.countedCash || 0).toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          {/* Additional breakdowns if present in closure */}
          {(extra.initialBalance !== undefined || extra.incomes !== undefined || extra.expenses !== undefined) && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Desglose Operativo Registrado</span>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                {extra.initialBalance !== undefined && (
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Saldo Inicial</span>
                    <span className="font-bold text-slate-800">${extra.initialBalance.toLocaleString('es-AR')}</span>
                  </div>
                )}
                {extra.incomes !== undefined && (
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-emerald-600 font-bold block">Ingresos</span>
                    <span className="font-bold text-emerald-700">+${extra.incomes.toLocaleString('es-AR')}</span>
                  </div>
                )}
                {extra.expenses !== undefined && (
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-rose-600 font-bold block">Egresos</span>
                    <span className="font-bold text-rose-700">-${extra.expenses.toLocaleString('es-AR')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Fecha y Hora</span>
                  <span className="font-bold text-slate-800">{formatDate(closure.date, closure.createdAt)}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Sucursal</span>
                  <span className="font-bold text-slate-800">
                    {getLocationName((closure.locationId as any) || 'aimogasta')}
                  </span>
                </div>
              </div>
            </div>

            {/* User if available */}
            {extra.user && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                <User className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Usuario / Operador</span>
                  <span className="font-bold text-slate-800">{extra.user}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            {closure.notes && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Observaciones</span>
                  <p className="font-medium text-slate-700 mt-0.5">{closure.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {closure.status !== 'CANCELLED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Anular Cierre</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            Cerrar
          </button>
        </div>

        {/* Cancellation Confirmation Modal */}
        <CancelOperationModal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          title="Anular Cierre de Caja"
          operationId={closure.id}
          effects={[
            'El arqueo cerrado dejará de considerarse como cierre definitivo del período',
            'Dejará de contabilizarse en los historiales y reportes de cierres',
            'El comprobante permanecerá visible con estado ANULADO para auditoría'
          ]}
          onConfirm={async (reason) => {
            const cancelled = await cashService.cancelCashClosure(closure.id, reason);
            setClosure(cancelled);
            onOperationCancelled?.();
          }}
        />
      </div>
    </div>
  );
};
