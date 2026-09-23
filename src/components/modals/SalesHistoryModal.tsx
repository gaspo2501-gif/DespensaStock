import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Receipt, 
  Search, 
  Calendar, 
  Building2, 
  CreditCard, 
  ChevronRight, 
  Loader2, 
  User,
  ShoppingBag
} from 'lucide-react';
import { SaleRecord } from '../../types/sale';
import { salesService } from '../../services/firebase/salesService';
import { useLocation } from '../../context/LocationContext';
import { SaleDetailModal } from './SaleDetailModal';
import { formatLocalDateTime } from '../../utils/dateUtils';

interface SalesHistoryModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onViewCustomer?: (customerId: string, customerName?: string) => void;
  onSaleCancelled?: () => void;
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({ 
  isOpen = true,
  onClose,
  onViewCustomer,
  onSaleCancelled
}) => {
  if (isOpen === false) return null;
  const { currentLocation, getLocationName } = useLocation();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  const loadSales = useCallback(() => {
    setLoading(true);
    salesService.getSales(currentLocation)
      .then((data) => {
        setSales(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando historial de ventas:', err);
        setLoading(false);
      });
  }, [currentLocation]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const filteredSales = sales.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (s.id && s.id.toLowerCase().includes(term)) ||
      (s.customerName && s.customerName.toLowerCase().includes(term)) ||
      (s.paymentMethod && s.paymentMethod.toLowerCase().includes(term)) ||
      s.items?.some(i => (i.productName || (i as any).name || '').toLowerCase().includes(term))
    );
  });

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    return formatLocalDateTime(isoStr);
  };

  const getMethodBadge = (method?: string) => {
    switch (method) {
      case 'cash':
        return <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Efectivo</span>;
      case 'mercado_pago':
        return <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">Mercado Pago</span>;
      case 'fiado':
        return <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">Fiado</span>;
      case 'transfer':
        return <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Transferencia</span>;
      default:
        return <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{method || 'Otro'}</span>;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div 
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Historial de Ventas</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {getLocationName(currentLocation)} • {sales.length} ventas registradas
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
                placeholder="Buscar por ID de venta, cliente, medio de pago o producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* List */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs font-bold">Cargando ventas...</p>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {searchTerm ? 'No se encontraron ventas con ese criterio.' : 'No hay ventas registradas para esta sucursal.'}
              </div>
            ) : (
              filteredSales.map((sale) => {
                const totalUnits = sale.totalItemsCount || sale.items?.reduce((a, b) => a + (b.quantity || 0), 0) || 0;
                return (
                  <div
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className={`p-3.5 border rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      sale.status === 'CANCELLED'
                        ? 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50/70 hover:border-rose-300 opacity-80'
                        : 'bg-slate-50 hover:bg-emerald-50/50 border-slate-200/80 hover:border-emerald-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-mono font-bold ${
                          sale.status === 'CANCELLED' ? 'text-rose-900 line-through' : 'text-slate-800 group-hover:text-emerald-950'
                        }`}>
                          {sale.id}
                        </span>
                        {sale.status === 'CANCELLED' ? (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-100/70 border border-rose-200 px-2 py-0.5 rounded-full">
                            ANULADO
                          </span>
                        ) : (
                          getMethodBadge(sale.paymentMethod)
                        )}
                        {sale.customerName && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{sale.customerName}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5 flex-wrap font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(sale.createdAt)}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{getLocationName((sale.locationId as any) || 'aimogasta')}</span>
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">
                          {totalUnits} u. en {sale.items?.length || 0} prod.
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <span className={`text-xs sm:text-sm font-black block ${
                          sale.status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}>
                          ${(sale.totalAmount || 0).toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold group-hover:underline">
                          Ver comprobante
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </div>
                );
              })
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

      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onViewCustomer={onViewCustomer}
          onOperationCancelled={() => {
            loadSales();
            onSaleCancelled?.();
          }}
        />
      )}
    </>
  );
};
