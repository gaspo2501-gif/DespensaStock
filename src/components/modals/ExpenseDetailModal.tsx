import React, { useState, useEffect } from 'react';
import { 
  X, 
  Receipt, 
  Calendar, 
  Building2, 
  CreditCard, 
  Tag, 
  FileText,
  Repeat,
  Loader2,
  AlertCircle,
  Ban
} from 'lucide-react';
import { Expense } from '../../types/expense';
import { expenseService } from '../../services/firebase/expenseService';
import { getLocationName } from '../../types/location';
import { CancelOperationModal } from './CancelOperationModal';
import { formatLocalDateTime, formatLocalDate } from '../../utils/dateUtils';

interface ExpenseDetailModalProps {
  expense?: Expense | null;
  expenseId?: string | null;
  onClose: () => void;
  onOperationCancelled?: () => void;
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  expense: initialExpense,
  expenseId,
  onClose,
  onOperationCancelled,
}) => {
  if (!initialExpense && !expenseId) return null;

  const [expense, setExpense] = useState<Expense | null>(initialExpense || null);
  const [loading, setLoading] = useState<boolean>(!initialExpense && !!expenseId);
  const [error, setError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialExpense) {
      setExpense(initialExpense);
      setLoading(false);
      return;
    }

    if (expenseId) {
      setLoading(true);
      setError(null);
      expenseService.getExpenseById(expenseId)
        .then((exp) => {
          if (exp) {
            setExpense(exp);
          } else {
            setError(`No se encontró el registro del gasto (${expenseId}).`);
          }
        })
        .catch((err) => {
          console.error('Error al cargar gasto:', err);
          setError('Error al recuperar información del gasto.');
        })
        .finally(() => setLoading(false));
    }
  }, [initialExpense, expenseId]);

  const formatDate = (dateStr?: string, createdIso?: string) => {
    if (!dateStr && !createdIso) return 'Fecha no disponible';
    if (createdIso) return formatLocalDateTime(createdIso);
    return formatLocalDate(dateStr);
  };

  const getPaymentMethodBadge = (method?: string) => {
    switch (method) {
      case 'cash':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">💵 Efectivo</span>;
      case 'mercado_pago':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">📱 Mercado Pago</span>;
      case 'transfer':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">🏦 Transferencia</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{method || 'Otro'}</span>;
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
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Detalle de Gasto</h3>
              <p className="text-xs text-slate-500 font-mono font-bold">
                {expense?.id || expenseId || 'Comprobante de gasto'}
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
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
              <p className="text-xs font-bold">Cargando datos del gasto...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !expense ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No hay información disponible para este gasto.
            </div>
          ) : (
            <>
              {/* Cancellation Alert Banner */}
              {expense.status === 'CANCELLED' && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs animate-fadeIn">
                  <div className="flex items-start gap-2.5 text-rose-800">
                    <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="uppercase font-black text-[11px] block text-rose-950 tracking-wider">
                        Gasto Anulado
                      </span>
                      <p className="font-medium text-rose-900 mt-0.5">
                        Motivo: <span className="font-bold">{expense.cancellationReason || 'Sin motivo especificado'}</span>
                      </p>
                    </div>
                  </div>
                  {expense.cancelledAt && (
                    <span className="text-[10px] text-rose-600 font-mono font-bold bg-rose-100/60 px-2 py-1 rounded-lg shrink-0">
                      {formatDate(undefined, expense.cancelledAt)}
                    </span>
                  )}
                </div>
              )}

              {/* Amount Banner */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">
                  Monto Egresado
                </span>
                <div className="text-2xl sm:text-3xl font-black text-rose-900 mt-0.5">
                  ${(expense.amount || 0).toLocaleString('es-AR')}
                </div>
                <span className="text-[11px] text-rose-700 font-bold mt-1 inline-block">
                  Egreso operativo del negocio
                </span>
              </div>

              {/* Information Grid */}
              <div className="space-y-2 text-xs">
                {/* Category & Description */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-rose-600" />
                    <span className="text-[10px] uppercase font-black text-slate-400">Categoría</span>
                    <span className="font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[10px]">
                      {expense.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm pl-5 pt-0.5">
                    {expense.description}
                  </h4>
                </div>

                {/* Date & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Fecha</span>
                      <span className="font-bold text-slate-800">{formatDate(expense.date, expense.createdAt)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Sucursal</span>
                      <span className="font-bold text-slate-800">
                        {getLocationName((expense.locationId as any) || 'aimogasta')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Medio de Pago</span>
                      <div className="mt-0.5">{getPaymentMethodBadge(expense.paymentMethod)}</div>
                    </div>
                  </div>

                  {expense.recurrent && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-200/80 px-2 py-1 rounded-full">
                      <Repeat className="w-3 h-3 text-slate-500" />
                      <span>Fijo / Recurrente</span>
                    </span>
                  )}
                </div>

                {/* Notes if available */}
                {expense.notes && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Observaciones</span>
                      <p className="font-medium text-slate-700 mt-0.5">{expense.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {expense && expense.status !== 'CANCELLED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Anular Gasto</span>
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
        {expense && (
          <CancelOperationModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            title="Anular Gasto Operativo"
            operationId={expense.id}
            effects={[
              'Se anulará el egreso y dejará de computarse en el total de gastos del negocio',
              'Se cancelará automáticamente el movimiento de egreso vinculado en la caja',
              'El comprobante permanecerá visible con estado ANULADO para auditoría'
            ]}
            onConfirm={async (reason) => {
              const cancelled = await expenseService.cancelExpense(expense.id, reason);
              setExpense(cancelled);
              onOperationCancelled?.();
            }}
          />
        )}
      </div>
    </div>
  );
};
