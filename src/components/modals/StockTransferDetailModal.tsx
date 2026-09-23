import React from 'react';
import { 
  X, 
  ArrowLeftRight, 
  Calendar, 
  Building2, 
  Package, 
  Barcode, 
  FileText,
  Boxes,
  ArrowRight
} from 'lucide-react';
import { StockTransfer } from '../../types/stockTransfer';
import { getLocationName } from '../../types/location';
import { formatLocalDateTime } from '../../utils/dateUtils';

interface StockTransferDetailModalProps {
  transfer?: StockTransfer | null;
  onClose: () => void;
}

export const StockTransferDetailModal: React.FC<StockTransferDetailModalProps> = ({
  transfer,
  onClose,
}) => {
  if (!transfer) return null;

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Fecha no disponible';
    return formatLocalDateTime(isoStr);
  };

  const extra = transfer as any;
  const sourceBefore = extra.sourceStockBefore ?? extra.prevSourceStock;
  const sourceAfter = extra.sourceStockAfter ?? extra.newSourceStock;
  const destBefore = extra.destStockBefore ?? extra.prevTargetStock;
  const destAfter = extra.destStockAfter ?? extra.newTargetStock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Detalle de Transferencia</h3>
              <p className="text-xs text-slate-500 font-mono font-bold">
                {transfer.id || 'Transferencia'}
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
          {/* Movement Origin & Destination Banner */}
          <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3">
            <div className="text-center flex-1">
              <span className="text-[10px] font-black uppercase text-amber-700 block">Origen</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">
                {transfer.sourceLocationName || getLocationName((transfer.sourceLocationId as any) || 'aimogasta')}
              </span>
            </div>

            <div className="w-9 h-9 rounded-full bg-amber-200/60 flex items-center justify-center text-amber-800 shrink-0">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="text-center flex-1">
              <span className="text-[10px] font-black uppercase text-amber-700 block">Destino</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">
                {transfer.destinationLocationName || getLocationName((transfer.destinationLocationId as any) || 'olascoaga')}
              </span>
            </div>
          </div>

          {/* Product and Quantity Info */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Producto Transferido</span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{transfer.productName || 'Producto'}</h4>
                {transfer.barcode && (
                  <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                    <Barcode className="w-3.5 h-3.5" />
                    <span>{transfer.barcode}</span>
                  </p>
                )}
              </div>
              <div className="text-right shrink-0 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Cantidad</span>
                <span className="text-base font-black text-amber-700">{transfer.quantity} u.</span>
              </div>
            </div>
          </div>

          {/* Date & Additional Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-black text-slate-400 block">Fecha y Hora</span>
                <span className="font-bold text-slate-800">{formatDate(transfer.createdAt)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-2.5">
              <Boxes className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-black text-slate-400 block">Tipo de Operación</span>
                <span className="font-bold text-slate-800">Traspaso entre depósitos</span>
              </div>
            </div>
          </div>

          {/* Before & After Stock Tracking if available */}
          {(sourceBefore !== undefined || destBefore !== undefined) && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
              <span className="text-[10px] uppercase font-black text-slate-500 block">
                Trazabilidad de Stock en el Momento de la Transferencia
              </span>
              <div className="grid grid-cols-2 gap-2">
                {sourceBefore !== undefined && (
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Origen ({transfer.sourceLocationName})</span>
                    <p className="text-xs font-black text-slate-800 mt-0.5">
                      {sourceBefore} u. &rarr; {sourceAfter ?? (sourceBefore - transfer.quantity)} u.
                    </p>
                  </div>
                )}
                {destBefore !== undefined && (
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Destino ({transfer.destinationLocationName})</span>
                    <p className="text-xs font-black text-slate-800 mt-0.5">
                      {destBefore} u. &rarr; {destAfter ?? (destBefore + transfer.quantity)} u.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes / Reason */}
          {transfer.notes && (
            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-start gap-2.5 text-xs">
              <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-black text-slate-400 block">Motivo / Observación</span>
                <p className="font-medium text-slate-700 mt-0.5">{transfer.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
