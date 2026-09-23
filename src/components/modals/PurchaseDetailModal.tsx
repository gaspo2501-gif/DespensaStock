import React, { useState, useEffect } from 'react';
import { 
  X, 
  Store, 
  Calendar, 
  Building2, 
  Boxes, 
  Package, 
  Barcode, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  FileText,
  Loader2,
  AlertCircle,
  Ban
} from 'lucide-react';
import { Purchase } from '../../types/purchase';
import { purchaseService } from '../../services/firebase/purchaseService';
import { getLocationName } from '../../types/location';
import { CancelOperationModal } from './CancelOperationModal';
import { formatLocalDateTime } from '../../utils/dateUtils';

interface PurchaseDetailModalProps {
  purchase?: Purchase | null;
  purchaseId?: string | null;
  onClose: () => void;
  onOperationCancelled?: () => void;
}

export const PurchaseDetailModal: React.FC<PurchaseDetailModalProps> = ({
  purchase: initialPurchase,
  purchaseId,
  onClose,
  onOperationCancelled,
}) => {
  if (!initialPurchase && !purchaseId) return null;

  const [purchase, setPurchase] = useState<Purchase | null>(initialPurchase || null);
  const [loading, setLoading] = useState<boolean>(!initialPurchase && !!purchaseId);
  const [error, setError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialPurchase) {
      setPurchase(initialPurchase);
      setLoading(false);
      return;
    }

    if (purchaseId) {
      setLoading(true);
      setError(null);
      purchaseService.getPurchaseById(purchaseId)
        .then((fetched) => {
          if (fetched) {
            setPurchase(fetched);
          } else {
            setError(`No se encontró el comprobante de compra con ID ${purchaseId}.`);
          }
        })
        .catch((err) => {
          console.error('Error al cargar detalle de compra:', err);
          setError('Error al recuperar los datos de la compra.');
        })
        .finally(() => setLoading(false));
    }
  }, [initialPurchase, purchaseId]);

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Fecha no disponible';
    return formatLocalDateTime(isoStr);
  };

  const renderCostVariation = (unitCost: number, previousCost?: number) => {
    if (previousCost === undefined || previousCost === null) {
      return <span className="text-[10px] text-slate-400 font-medium">Primer ingreso</span>;
    }
    const diff = unitCost - previousCost;
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 font-bold">
          <Minus className="w-2.5 h-2.5" />
          <span>Sin cambio</span>
        </span>
      );
    }
    const pct = previousCost > 0 ? Math.round((diff / previousCost) * 100) : 0;
    if (diff > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full font-bold">
          <TrendingUp className="w-2.5 h-2.5" />
          <span>+${diff.toLocaleString('es-AR')} (+{pct}%)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
        <TrendingDown className="w-2.5 h-2.5" />
        <span>-${Math.abs(diff).toLocaleString('es-AR')} ({pct}%)</span>
      </span>
    );
  };

  const totalUnits = purchase?.totalItemsCount || purchase?.items?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Detalle de Ingreso / Compra</h3>
              <p className="text-xs text-slate-500 font-mono font-bold">
                {purchase?.id || purchaseId || 'Ingreso de mercadería'}
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
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-bold">Cargando datos de la compra...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !purchase ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No hay información disponible para este ingreso.
            </div>
          ) : (
            <>
              {/* Cancellation Alert Banner */}
              {purchase.status === 'CANCELLED' && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs animate-fadeIn">
                  <div className="flex items-start gap-2.5 text-rose-800">
                    <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="uppercase font-black text-[11px] block text-rose-950 tracking-wider">
                        Ingreso de Mercadería Anulado
                      </span>
                      <p className="font-medium text-rose-900 mt-0.5">
                        Motivo: <span className="font-bold">{purchase.cancellationReason || 'Sin motivo especificado'}</span>
                      </p>
                    </div>
                  </div>
                  {purchase.cancelledAt && (
                    <span className="text-[10px] text-rose-600 font-mono font-bold bg-rose-100/60 px-2 py-1 rounded-lg shrink-0">
                      {formatDate(purchase.cancelledAt)}
                    </span>
                  )}
                </div>
              )}

              {/* Metadata Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <Store className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Proveedor</span>
                    <span className="font-bold text-slate-900 truncate block">
                      {purchase.providerName || 'Proveedor no especificado'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Fecha y Hora</span>
                    <span className="font-bold text-slate-800">{formatDate(purchase.createdAt)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Sucursal de Ingreso</span>
                    <span className="font-bold text-slate-800">
                      {getLocationName((purchase.locationId as any) || 'aimogasta')}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
                  <Boxes className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block">Unidades Ingresadas</span>
                    <span className="font-bold text-slate-800">
                      {totalUnits} u. en {purchase.items?.length || 0} producto(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Products Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 px-1">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span>Productos Ingresados ({purchase.items?.length || 0})</span>
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Producto</th>
                          <th className="py-2.5 px-2 text-center">Cant.</th>
                          <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                          <th className="py-2.5 px-3 text-right">Subtotal Costo</th>
                          <th className="py-2.5 px-3 text-right">P. Venta Fijado</th>
                          <th className="py-2.5 px-3 text-center">Variación Costo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {purchase.items && purchase.items.length > 0 ? (
                          purchase.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 leading-snug">
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                                  {item.barcode && (
                                    <span className="font-mono text-slate-400 flex items-center gap-0.5">
                                      <Barcode className="w-3 h-3" />
                                      {item.barcode}
                                    </span>
                                  )}
                                  {item.brand && <span>{item.brand}</span>}
                                  {item.presentation && <span>{item.presentation}</span>}
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-center font-black text-slate-700">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                                ${(item.unitCost || 0).toLocaleString('es-AR')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                ${(item.totalCost || (item.quantity * (item.unitCost || 0))).toLocaleString('es-AR')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                                {item.finalSalePrice ? `$${item.finalSalePrice.toLocaleString('es-AR')}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {renderCostVariation(item.unitCost, item.previousCost)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">
                              Sin detalle de productos registrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Total Purchase Amount */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-md">
                <div>
                  <span className="text-[11px] font-extrabold uppercase text-slate-400 block tracking-wider">
                    Total Facturado de la Compra
                  </span>
                  <span className="text-xs text-slate-300">
                    Costo total de mercadería ingresada
                  </span>
                </div>
                <div className="text-2xl font-black text-white">
                  ${(purchase.totalAmount || 0).toLocaleString('es-AR')}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {purchase && purchase.status !== 'CANCELLED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Anular Ingreso</span>
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
        {purchase && (
          <CancelOperationModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            title="Anular Ingreso de Mercadería"
            operationId={purchase.id}
            effects={[
              'Se descontará el stock sumado por cada producto de este ingreso',
              'Validación estricta Todo o Nada: si algún producto ya fue vendido y no alcanza el stock para revertir, la anulación se rechazará',
              'El comprobante permanecerá visible con estado ANULADO para auditoría'
            ]}
            onConfirm={async (reason) => {
              const cancelled = await purchaseService.cancelPurchase(purchase.id, reason);
              setPurchase(cancelled);
              onOperationCancelled?.();
            }}
          />
        )}
      </div>
    </div>
  );
};
