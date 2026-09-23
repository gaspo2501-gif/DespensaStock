import React, { useState, useEffect } from 'react';
import { 
  X, 
  Receipt, 
  Calendar, 
  Building2, 
  CreditCard, 
  User, 
  Package, 
  Barcode, 
  ExternalLink,
  Loader2,
  AlertCircle,
  Ban
} from 'lucide-react';
import { SaleRecord } from '../../types/sale';
import { salesService } from '../../services/firebase/salesService';
import { getLocationName } from '../../types/location';
import { CancelOperationModal } from './CancelOperationModal';
import { formatLocalDateTime } from '../../utils/dateUtils';

interface SaleDetailModalProps {
  sale?: SaleRecord | null;
  saleId?: string | null;
  onClose: () => void;
  onViewCustomer?: (customerId: string, customerName?: string) => void;
  onOperationCancelled?: () => void;
}

export const SaleDetailModal: React.FC<SaleDetailModalProps> = ({
  sale: initialSale,
  saleId,
  onClose,
  onViewCustomer,
  onOperationCancelled,
}) => {
  if (!initialSale && !saleId) return null;

  const [sale, setSale] = useState<SaleRecord | null>(initialSale || null);
  const [loading, setLoading] = useState<boolean>(!initialSale && !!saleId);
  const [error, setError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialSale) {
      setSale(initialSale);
      setLoading(false);
      return;
    }

    if (saleId) {
      setLoading(true);
      setError(null);
      salesService.getSaleById(saleId)
        .then((fetched) => {
          if (fetched) {
            setSale(fetched);
          } else {
            setError(`No se encontró el comprobante de la venta con ID ${saleId}.`);
          }
        })
        .catch((err) => {
          console.error('Error al cargar detalle de venta:', err);
          setError('Error al recuperar los datos de la venta.');
        })
        .finally(() => setLoading(false));
    }
  }, [initialSale, saleId]);

  const getPaymentMethodBadge = (method?: string) => {
    switch (method) {
      case 'cash':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">💵 Efectivo</span>;
      case 'mercado_pago':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">📱 Mercado Pago</span>;
      case 'fiado':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">📒 Cuenta Corriente / Fiado</span>;
      case 'transfer':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">🏦 Transferencia</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{method || 'Otro'}</span>;
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Fecha no disponible';
    return formatLocalDateTime(isoStr);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Detalle de Venta</h3>
              <p className="text-xs text-slate-500 font-mono font-bold">
                {sale?.id || saleId || 'Comprobante'}
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-bold">Cargando comprobante de venta...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !sale ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No hay información disponible para esta venta.
            </div>
          ) : (
            <>
              {/* Cancellation Alert Banner */}
              {sale.status === 'CANCELLED' && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs animate-fadeIn">
                  <div className="flex items-start gap-2.5 text-rose-800">
                    <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="uppercase font-black text-[11px] block text-rose-950 tracking-wider">
                        Venta Anulada
                      </span>
                      <p className="font-medium text-rose-900 mt-0.5">
                        Motivo: <span className="font-bold">{sale.cancellationReason || 'Sin motivo especificado'}</span>
                      </p>
                    </div>
                  </div>
                  {sale.cancelledAt && (
                    <span className="text-[10px] text-rose-600 font-mono font-bold bg-rose-100/60 px-2 py-1 rounded-lg shrink-0">
                      {formatDate(sale.cancelledAt)}
                    </span>
                  )}
                </div>
              )}

              {/* Summary Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Fecha y Hora</span>
                    <span className="font-bold text-slate-800">{formatDate(sale.createdAt)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Sucursal</span>
                    <span className="font-bold text-slate-800">
                      {getLocationName((sale.locationId as any) || 'aimogasta')}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5 sm:col-span-2 justify-between">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Medio de Pago</span>
                      <div className="mt-0.5">{getPaymentMethodBadge(sale.paymentMethod)}</div>
                    </div>
                  </div>
                  {sale.paymentMethod === 'fiado' && sale.customerId && onViewCustomer && (
                    <button
                      onClick={() => {
                        onClose();
                        onViewCustomer(sale.customerId!, sale.customerName);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all active:scale-98 shadow-2xs"
                    >
                      <span>Ver Ficha del Cliente</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Customer Information if applicable */}
                {(sale.customerName || sale.customerId) && (
                  <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200/80 flex items-center justify-between gap-2.5 sm:col-span-2">
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-purple-700 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase font-black text-purple-600 block">Cliente Asociado</span>
                        <span className="font-bold text-purple-950 text-xs">
                          {sale.customerName || 'Cliente con cuenta corriente'}
                        </span>
                      </div>
                    </div>
                    {sale.customerId && onViewCustomer && sale.paymentMethod !== 'fiado' && (
                      <button
                        onClick={() => {
                          onClose();
                          onViewCustomer(sale.customerId!, sale.customerName);
                        }}
                        className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1"
                      >
                        <span>Ver Ficha</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Products Breakdown Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 px-1">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span>Desglose de Productos ({sale.items?.length || 0})</span>
                  </span>
                  <span className="text-slate-400 font-bold">
                    {sale.totalItemsCount || sale.items?.reduce((a, b) => a + (b.quantity || 0), 0) || 0} unidades
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-2 text-center">Cant.</th>
                        <th className="py-2 px-3 text-right">P. Unit.</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sale.items && sale.items.length > 0 ? (
                        sale.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 leading-snug">
                                {item.productName || (item as any).name || 'Producto'}
                              </div>
                              {item.barcode && (
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Barcode className="w-3 h-3" />
                                  <span>{item.barcode}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-black text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600 font-bold">
                              ${(item.unitPrice || 0).toLocaleString('es-AR')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                              ${(item.subtotal || (item.quantity * (item.unitPrice || 0))).toLocaleString('es-AR')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400">
                            Sin detalle de artículos en el registro histórico.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Card */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-md">
                <div>
                  <span className="text-[11px] font-extrabold uppercase text-slate-400 block tracking-wider">
                    Total de la Venta
                  </span>
                  <span className="text-xs text-emerald-400 font-medium">
                    {sale.paymentMethod === 'fiado' ? 'Pendiente en cuenta corriente' : 'Abonado'}
                  </span>
                </div>
                <div className="text-2xl font-black text-white">
                  ${(sale.totalAmount || 0).toLocaleString('es-AR')}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {sale && sale.status !== 'CANCELLED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Anular Venta</span>
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
        {sale && (
          <CancelOperationModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            title="Anular Venta"
            operationId={sale.id}
            effects={[
              'Se devolverá el stock de todos los artículos vendidos a la sucursal original',
              sale.paymentMethod === 'fiado'
                ? 'Se cancelará la deuda originada en la cuenta corriente del cliente'
                : 'Se anulará el ingreso de dinero correspondiente en la caja',
              'El comprobante permanecerá visible con estado ANULADO para auditoría'
            ]}
            onConfirm={async (reason) => {
              const cancelled = await salesService.cancelSale(sale.id, reason);
              setSale(cancelled);
              onOperationCancelled?.();
            }}
          />
        )}
      </div>
    </div>
  );
};
