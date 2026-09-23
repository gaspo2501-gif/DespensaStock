import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  Search, 
  Calendar, 
  Barcode, 
  ChevronRight, 
  Loader2, 
  ArrowRight
} from 'lucide-react';
import { StockTransfer } from '../../types/stockTransfer';
import { stockTransferService } from '../../services/firebase/stockTransferService';
import { useLocation } from '../../context/LocationContext';
import { StockTransferDetailModal } from './StockTransferDetailModal';
import { formatLocalDateTime } from '../../utils/dateUtils';

interface TransferHistoryModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSelectTransfer?: (transfer: StockTransfer) => void;
}

export const TransferHistoryModal: React.FC<TransferHistoryModalProps> = ({ 
  isOpen = true, 
  onClose,
  onSelectTransfer
}) => {
  if (isOpen === false) return null;
  const { currentLocation, getLocationName } = useLocation();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    stockTransferService.getTransfers(currentLocation)
      .then((data) => {
        if (isMounted) {
          setTransfers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error cargando historial de transferencias:', err);
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [currentLocation]);

  const filteredTransfers = transfers.filter((t) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (t.productName && t.productName.toLowerCase().includes(term)) ||
      (t.barcode && t.barcode.toLowerCase().includes(term)) ||
      (t.sourceLocationName && t.sourceLocationName.toLowerCase().includes(term)) ||
      (t.destinationLocationName && t.destinationLocationName.toLowerCase().includes(term)) ||
      (t.id && t.id.toLowerCase().includes(term))
    );
  });

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    return formatLocalDateTime(isoStr);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div 
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden"
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
                <h3 className="text-base font-black text-slate-900">Historial de Transferencias</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {getLocationName(currentLocation)} • {transfers.length} movimientos entre sucursales
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

          {/* Search bar */}
          <div className="p-3 sm:p-4 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por producto, código de barras o sucursal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* List */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                <p className="text-xs font-bold">Cargando transferencias...</p>
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {searchTerm ? 'No se encontraron transferencias con ese criterio.' : 'No hay transferencias registradas.'}
              </div>
            ) : (
              filteredTransfers.map((transfer) => (
                <div
                  key={transfer.id}
                  onClick={() => setSelectedTransfer(transfer)}
                  className="p-3.5 bg-slate-50 hover:bg-amber-50/50 border border-slate-200/80 hover:border-amber-300 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-slate-900 group-hover:text-amber-950 truncate">
                      {transfer.productName || 'Producto'}
                    </h4>
                    
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-1 flex-wrap font-medium">
                      <span className="font-bold text-slate-700">{transfer.sourceLocationName}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-slate-700">{transfer.destinationLocationName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(transfer.createdAt)}</span>
                      </span>
                    </div>

                    {transfer.barcode && (
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Barcode className="w-3 h-3" />
                        <span>{transfer.barcode}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div>
                      <span className="text-xs sm:text-sm font-black text-amber-700 block">
                        {transfer.quantity} u.
                      </span>
                      <span className="text-[10px] text-amber-600 font-bold group-hover:underline">
                        Ver detalle
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
                  </div>
                </div>
              ))
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

      {selectedTransfer && (
        <StockTransferDetailModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
        />
      )}
    </>
  );
};
