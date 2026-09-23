import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  Calendar, 
  Building2, 
  CreditCard, 
  User, 
  FileText,
  Loader2,
  AlertCircle,
  ExternalLink,
  Ban
} from 'lucide-react';
import { AccountMovement } from '../../types/account';
import { accountService } from '../../services/firebase/accountService';
import { customerService } from '../../services/firebase/customerService';
import { getLocationName } from '../../types/location';
import { CancelOperationModal } from './CancelOperationModal';
import { formatLocalDateTime } from '../../utils/dateUtils';

interface PaymentDetailModalProps {
  movement?: AccountMovement | null;
  movementId?: string | null;
  customerName?: string;
  onClose: () => void;
  onViewCustomer?: (customerId: string, customerName?: string) => void;
  onOperationCancelled?: () => void;
}

export const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({
  movement: initialMovement,
  movementId,
  customerName: initialCustomerName,
  onClose,
  onViewCustomer,
  onOperationCancelled,
}) => {
  if (!initialMovement && !movementId) return null;

  const [movement, setMovement] = useState<AccountMovement | null>(initialMovement || null);
  const [customerName, setCustomerName] = useState<string>(initialCustomerName || '');
  const [loading, setLoading] = useState<boolean>(!initialMovement && !!movementId);
  const [error, setError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialMovement) {
      setMovement(initialMovement);
      if (!initialCustomerName && initialMovement.customerId) {
        customerService.getCustomerById(initialMovement.customerId)
          .then(c => c && setCustomerName(c.name))
          .catch(() => {});
      }
      return;
    }

    if (movementId) {
      setLoading(true);
      setError(null);
      accountService.getMovementById(movementId)
        .then(async (mov) => {
          if (mov) {
            setMovement(mov);
            if (mov.customerId && !initialCustomerName) {
              const cust = await customerService.getCustomerById(mov.customerId);
              if (cust) setCustomerName(cust.name);
            }
          } else {
            setError(`No se encontró el comprobante del pago (${movementId}).`);
          }
        })
        .catch((err) => {
          console.error('Error al cargar pago:', err);
          setError('Error al recuperar información del pago.');
        })
        .finally(() => setLoading(false));
    }
  }, [initialMovement, movementId, initialCustomerName]);

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Fecha no disponible';
    return formatLocalDateTime(isoStr);
  };

  const formatPaymentMethod = (method?: string) => {
    switch (method) {
      case 'cash':
        return 'Efectivo';
      case 'mercado_pago':
        return 'Mercado Pago';
      case 'transfer':
        return 'Transferencia bancaria';
      case 'other':
        return 'Otro';
      default:
        return method || 'Efectivo';
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Comprobante de Pago</h3>
              <p className="text-xs text-slate-500 font-mono font-bold">
                {movement?.id || movementId || 'Pago a cuenta'}
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
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-bold">Cargando datos del pago...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !movement ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No hay información disponible para este pago.
            </div>
          ) : (
            <>
              {/* Cancellation Alert Banner */}
              {movement.status === 'CANCELLED' && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs animate-fadeIn">
                  <div className="flex items-start gap-2.5 text-rose-800">
                    <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="uppercase font-black text-[11px] block text-rose-950 tracking-wider">
                        Pago Anulado
                      </span>
                      <p className="font-medium text-rose-900 mt-0.5">
                        Motivo: <span className="font-bold">{movement.cancellationReason || 'Sin motivo especificado'}</span>
                      </p>
                    </div>
                  </div>
                  {movement.cancelledAt && (
                    <span className="text-[10px] text-rose-600 font-mono font-bold bg-rose-100/60 px-2 py-1 rounded-lg shrink-0">
                      {formatDate(movement.cancelledAt)}
                    </span>
                  )}
                </div>
              )}

              {/* Payment Amount Card */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                  Importe Abonado
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-0.5">
                  ${(movement.amount || 0).toLocaleString('es-AR')}
                </div>
                <span className="text-[11px] text-emerald-700 font-bold mt-1 inline-block">
                  Acreditado a cuenta corriente
                </span>
              </div>

              {/* Information Grid */}
              <div className="space-y-2 text-xs">
                {/* Customer */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <User className="w-4 h-4 text-purple-700 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Cliente</span>
                      <span className="font-bold text-slate-900 truncate block">
                        {customerName || 'Cliente registrado'}
                      </span>
                    </div>
                  </div>
                  {movement.customerId && onViewCustomer && (
                    <button
                      onClick={() => {
                        onClose();
                        onViewCustomer(movement.customerId, customerName);
                      }}
                      className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Ver Ficha</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Date */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Fecha y Hora</span>
                    <span className="font-bold text-slate-800">{formatDate(movement.createdAt)}</span>
                  </div>
                </div>

                {/* Location */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Sucursal</span>
                    <span className="font-bold text-slate-800">
                      {getLocationName((movement.locationId as any) || 'aimogasta')}
                    </span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Medio de Pago</span>
                    <span className="font-bold text-slate-800">
                      {formatPaymentMethod(movement.paymentMethod)}
                    </span>
                  </div>
                </div>

                {/* Notes if available */}
                {(movement.notes || movement.description) && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Observación</span>
                      <p className="font-medium text-slate-700 mt-0.5">
                        {movement.notes || movement.description}
                      </p>
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
            {movement && movement.status !== 'CANCELLED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Anular Pago</span>
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
        {movement && (
          <CancelOperationModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            title="Anular Pago a Cuenta"
            operationId={movement.id}
            effects={[
              'Se restablecerá la deuda original en la cuenta corriente del cliente',
              'Se anulará el ingreso de dinero correspondiente en la caja',
              'El registro de pago permanecerá visible con estado ANULADO para auditoría'
            ]}
            onConfirm={async (reason) => {
              const cancelled = await accountService.cancelPayment(movement.id, reason);
              setMovement(cancelled);
              onOperationCancelled?.();
            }}
          />
        )}
      </div>
    </div>
  );
};
