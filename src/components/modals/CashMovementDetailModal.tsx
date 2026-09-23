import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Building2, 
  CreditCard, 
  Tag, 
  FileText,
  ExternalLink,
  Receipt,
  User,
  ShoppingBag,
  Ban,
  Info
} from 'lucide-react';
import { CashMovement } from '../../types/cash';
import { getLocationName } from '../../types/location';
import { cashService } from '../../services/firebase/cashService';
import { CancelOperationModal } from './CancelOperationModal';
import { formatLocalDateTime, formatLocalDate } from '../../utils/dateUtils';

interface CashMovementDetailModalProps {
  movement?: CashMovement | null;
  onClose: () => void;
  onViewSale?: (saleId: string) => void;
  onViewExpense?: (expenseId: string) => void;
  onViewPayment?: (paymentId: string) => void;
  onOpenSaleDetail?: (saleId: string) => void;
  onOpenExpenseDetail?: (expenseId: string) => void;
  onOpenPaymentDetail?: (paymentId: string) => void;
  onOperationCancelled?: () => void;
}

export const CashMovementDetailModal: React.FC<CashMovementDetailModalProps> = ({
  movement: initialMovement,
  onClose,
  onViewSale,
  onViewExpense,
  onViewPayment,
  onOpenSaleDetail,
  onOpenExpenseDetail,
  onOpenPaymentDetail,
  onOperationCancelled,
}) => {
  if (!initialMovement) return null;

  const [movement, setMovement] = useState<CashMovement>(initialMovement);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialMovement) {
      setMovement(initialMovement);
    }
  }, [initialMovement]);

  const handleViewSale = onViewSale || onOpenSaleDetail;
  const handleViewExpense = onViewExpense || onOpenExpenseDetail;
  const handleViewPayment = onViewPayment || onOpenPaymentDetail;
  const formatDate = (dateStr?: string, createdIso?: string) => {
    if (!dateStr && !createdIso) return 'Fecha no disponible';
    if (createdIso) return formatLocalDateTime(createdIso);
    return formatLocalDate(dateStr);
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'SALE':
        return { label: 'Venta de Mostrador', icon: <ShoppingBag className="w-3.5 h-3.5" />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'CUSTOMER_PAYMENT':
        return { label: 'Cobro de Cuenta Corriente', icon: <User className="w-3.5 h-3.5" />, color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'EXPENSE':
        return { label: 'Gasto Operativo', icon: <Receipt className="w-3.5 h-3.5" />, color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'MANUAL':
      default:
        return { label: 'Movimiento Manual de Caja', icon: <Tag className="w-3.5 h-3.5" />, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
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

  const sourceMeta = getSourceLabel(movement.sourceType);
  const isIncome = movement.type === 'INCOME';

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
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm text-white ${
              isIncome ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              {isIncome ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Detalle del Movimiento</h3>
              <p className="text-xs text-slate-500 font-mono font-bold">
                {movement.id}
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
          {movement.status === 'CANCELLED' && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs animate-fadeIn">
              <div className="flex items-start gap-2.5 text-rose-800">
                <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="uppercase font-black text-[11px] block text-rose-950 tracking-wider">
                    Movimiento Anulado
                  </span>
                  <p className="font-medium text-rose-900 mt-0.5">
                    Motivo: <span className="font-bold">{movement.cancellationReason || 'Sin motivo especificado'}</span>
                  </p>
                </div>
              </div>
              {movement.cancelledAt && (
                <span className="text-[10px] text-rose-600 font-mono font-bold bg-rose-100/60 px-2 py-1 rounded-lg shrink-0">
                  {formatDate(undefined, movement.cancelledAt)}
                </span>
              )}
            </div>
          )}

          {/* Amount Hero Banner */}
          <div className={`p-4 rounded-2xl border text-center ${
            isIncome ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${
              isIncome ? 'text-emerald-800' : 'text-rose-800'
            }`}>
              {isIncome ? 'Ingreso de Caja (+)' : 'Egreso de Caja (-)'}
            </span>
            <div className={`text-3xl font-black mt-0.5 ${
              isIncome ? 'text-emerald-900' : 'text-rose-900'
            }`}>
              {isIncome ? '+' : '-'}${movement.amount.toLocaleString('es-AR')}
            </div>
          </div>

          {/* Connected Action Button if applicable */}
          {movement.sourceType === 'SALE' && movement.sourceId && handleViewSale && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-black text-emerald-800 block">Venta Asociada</span>
                <span className="text-xs font-mono font-bold text-slate-700">{movement.sourceId}</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  handleViewSale(movement.sourceId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98"
              >
                <span>Ver Venta</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {movement.sourceType === 'CUSTOMER_PAYMENT' && movement.sourceId && handleViewPayment && (
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-black text-purple-800 block">Cobro Registrado</span>
                <span className="text-xs font-mono font-bold text-slate-700">{movement.sourceId}</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  handleViewPayment(movement.sourceId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98"
              >
                <span>Ver Pago</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {movement.sourceType === 'EXPENSE' && movement.sourceId && handleViewExpense && (
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-black text-rose-800 block">Gasto Registrado</span>
                <span className="text-xs font-mono font-bold text-slate-700">{movement.sourceId}</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  handleViewExpense(movement.sourceId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98"
              >
                <span>Ver Gasto</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Information Grid */}
          <div className="space-y-2 text-xs">
            {/* Description & Concept */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Concepto / Descripción</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{movement.description}</p>
            </div>

            {/* Origin & Reference */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-black text-slate-400 block">Origen</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border mt-1 ${sourceMeta.color}`}>
                  {sourceMeta.icon}
                  <span>{sourceMeta.label}</span>
                </span>
              </div>
              {movement.sourceId && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Referencia</span>
                  <span className="font-mono text-slate-600 text-[11px] block mt-1">{movement.sourceId}</span>
                </div>
              )}
            </div>

            {/* Date & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Fecha y Hora</span>
                  <span className="font-bold text-slate-800">{formatDate(movement.date, movement.createdAt)}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Sucursal</span>
                  <span className="font-bold text-slate-800">
                    {getLocationName((movement.locationId as any) || 'aimogasta')}
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
                  <div className="mt-0.5">{getPaymentMethodBadge(movement.paymentMethod)}</div>
                </div>
              </div>
            </div>

            {/* Notes if available */}
            {movement.notes && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Observaciones</span>
                  <p className="font-medium text-slate-700 mt-0.5">{movement.notes}</p>
                </div>
              </div>
            )}
            {/* Automatic movement notice */}
            {movement.sourceType !== 'MANUAL' && movement.status !== 'CANCELLED' && (
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-black text-amber-950 block">
                    Movimiento Generado Automáticamente
                  </span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Este movimiento de caja proviene de una operación del sistema. Para anularlo, accedé a la operación de origen y anúlala directamente desde allí.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {movement.sourceType === 'MANUAL' && movement.status !== 'CANCELLED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Anular Movimiento</span>
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
        {movement.sourceType === 'MANUAL' && (
          <CancelOperationModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            title="Anular Movimiento Manual de Caja"
            operationId={movement.id}
            effects={[
              `Se anulará el ${movement.type === 'IN' ? 'ingreso' : 'egreso'} de caja de $${movement.amount.toLocaleString('es-AR')}`,
              'Dejará de impactar en los totales del arqueo y en los reportes de caja',
              'El registro permanecerá visible con estado ANULADO para auditoría'
            ]}
            onConfirm={async (reason) => {
              const cancelled = await cashService.cancelManualMovement(movement.id, reason);
              setMovement(cancelled);
              onOperationCancelled?.();
            }}
          />
        )}
      </div>
    </div>
  );
};
