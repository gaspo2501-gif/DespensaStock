import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Store, 
  DollarSign, 
  CreditCard, 
  Users, 
  ShoppingCart, 
  Receipt, 
  Calculator, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Calendar, 
  Package, 
  Smartphone, 
  Building2, 
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { 
  FullBusinessReport, 
  SoldProductCostDetail, 
  CollectedPaymentDetail 
} from '../../types/report';
import { formatLocalDate } from '../../utils/dateUtils';

export type TraceabilityMetricType = 
  | 'facturacion'
  | 'cobrado'
  | 'ventas_fiadas'
  | 'cuentas_por_cobrar'
  | 'compras_mercaderia'
  | 'gastos_operativos'
  | 'costo_estimado';

interface ReportTraceabilityModalProps {
  type: TraceabilityMetricType;
  report: FullBusinessReport;
  onClose: () => void;
  onSelectSale?: (saleId: string) => void;
  onSelectCustomer?: (customerId: string, customerName?: string) => void;
  onSelectPurchase?: (purchaseId: string) => void;
}

export const ReportTraceabilityModal: React.FC<ReportTraceabilityModalProps> = ({
  type,
  report,
  onClose,
  onSelectSale,
  onSelectCustomer,
  onSelectPurchase,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const traceability = report.traceability;

  // Title and description helper
  const getHeaderInfo = () => {
    switch (type) {
      case 'facturacion':
        return {
          title: 'Composición de Facturación',
          subtitle: `Total de ventas realizadas en el período (${report.dateRangeLabel})`,
          badge: `$${report.sales.totalRevenue.toLocaleString('es-AR')}`,
          badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: DollarSign,
        };
      case 'cobrado':
        return {
          title: 'Composición de Dinero Cobrado',
          subtitle: `Cobros efectivos en el período (Efectivo, Mercado Pago, Transferencias)`,
          badge: `$${report.sales.collectedAmount.toLocaleString('es-AR')}`,
          badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: ArrowUpRight,
        };
      case 'ventas_fiadas':
        return {
          title: 'Ventas Fiadas / Cuenta Corriente',
          subtitle: `Ventas otorgadas a crédito en el período (${report.dateRangeLabel})`,
          badge: `$${report.sales.creditSalesAmount.toLocaleString('es-AR')}`,
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: Users,
        };
      case 'cuentas_por_cobrar':
        return {
          title: 'Cuentas por Cobrar (Deuda Global Actual)',
          subtitle: `Clientes que actualmente mantienen saldo pendiente de pago`,
          badge: `$${report.customerDebt.totalDebtBalance.toLocaleString('es-AR')}`,
          badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
          icon: CreditCard,
        };
      case 'compras_mercaderia':
        return {
          title: 'Compras de Mercadería a Proveedores',
          subtitle: `Ingresos de stock y órdenes de compra en el período (${report.dateRangeLabel})`,
          badge: `$${report.purchases.totalPurchasesAmount.toLocaleString('es-AR')}`,
          badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: ShoppingCart,
        };
      case 'gastos_operativos':
        return {
          title: 'Composición de Gastos Operativos',
          subtitle: `Gastos del negocio en el período (${report.dateRangeLabel})`,
          badge: `$${report.expenses.totalExpensesAmount.toLocaleString('es-AR')}`,
          badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: Receipt,
        };
      case 'costo_estimado':
        return {
          title: 'Costo Estimado y Resultado Comercial',
          subtitle: 'Composición del costo de la mercadería vendida (CMV)',
          badge: `$${report.estimatedResult.estimatedCogs.toLocaleString('es-AR')}`,
          badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: Calculator,
        };
    }
  };

  const headerInfo = getHeaderInfo();
  const Icon = headerInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Icon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">{headerInfo.title}</h3>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${headerInfo.badgeColor}`}>
                  {headerInfo.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{headerInfo.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300/70 flex items-center justify-center text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* SEARCH BAR (For lists with many items) */}
          {type !== 'costo_estimado' && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por cliente, concepto o comprobante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
          )}

          {/* 1. FACTURACIÓN VIEW */}
          {type === 'facturacion' && (
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                Listado de ventas del período ({traceability?.sales?.length || 0})
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {(traceability?.sales || [])
                  .filter((s) => 
                    !searchTerm || 
                    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((sale) => (
                    <div
                      key={sale.id}
                      onClick={() => onSelectSale?.(sale.id)}
                      className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {sale.customerName || 'Consumidor Final'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            #{sale.id.slice(-6)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {sale.date || formatLocalDate(sale.createdAt)}
                          </span>
                          <span>•</span>
                          <span>{sale.totalItemsCount || sale.items?.length || 0} prod.</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600 uppercase text-[10px]">
                            {sale.paymentMethod === 'mixed' ? 'Combinado' : sale.paymentMethod === 'credit' ? 'Fiado' : sale.paymentMethod || 'Efectivo'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-900">
                          ${(sale.totalAmount || 0).toLocaleString('es-AR')}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-colors" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 2. COBRADO VIEW */}
          {type === 'cobrado' && (
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                Ingresos cobrados de ventas y cobranzas ({traceability?.collectedMovements?.length || 0})
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {(traceability?.collectedMovements || [])
                  .filter((m) =>
                    !searchTerm ||
                    m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    m.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((mov) => (
                    <div key={mov.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-xs text-slate-900">{mov.description}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{mov.date}</span>
                          <span>•</span>
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full text-[10px]">
                            {mov.paymentMethod}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-sm text-emerald-700">
                          +${mov.amount.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 3. VENTAS FIADAS VIEW */}
          {type === 'ventas_fiadas' && (
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                Ventas a crédito en el período ({traceability?.creditSales?.length || 0})
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {(traceability?.creditSales || [])
                  .filter((s) =>
                    !searchTerm ||
                    (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((sale) => (
                    <div
                      key={sale.id}
                      onClick={() => onSelectSale?.(sale.id)}
                      className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {sale.customerName || 'Cliente en Cuenta Corriente'}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{sale.date || formatLocalDate(sale.createdAt)}</span>
                          <span>•</span>
                          <span>{sale.totalItemsCount || sale.items?.length || 0} unidades</span>
                          {sale.paymentMethod === 'mixed' && (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                              Pago mixto con fiado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-amber-800">
                          ${(sale.paymentBreakdown?.credit || sale.totalAmount || 0).toLocaleString('es-AR')}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-colors" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 4. CUENTAS POR COBRAR VIEW */}
          {type === 'cuentas_por_cobrar' && (
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                Clientes con deuda activa ({traceability?.debtors?.length || 0})
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {(traceability?.debtors || [])
                  .filter((d) =>
                    !searchTerm ||
                    d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (d.phone && d.phone.includes(searchTerm))
                  )
                  .map((debtor) => (
                    <div
                      key={debtor.customerId}
                      onClick={() => onSelectCustomer?.(debtor.customerId, debtor.customerName)}
                      className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {debtor.customerName}
                        </div>
                        {debtor.phone && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Tel: {debtor.phone}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-purple-900">
                          ${debtor.currentDebt.toLocaleString('es-AR')}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-colors" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 5. COMPRAS MERCADERÍA VIEW */}
          {type === 'compras_mercaderia' && (
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                Órdenes de compra registradas ({traceability?.purchases?.length || 0})
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {(traceability?.purchases || [])
                  .filter((p) =>
                    !searchTerm ||
                    (p.providerName && p.providerName.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((purch) => (
                    <div
                      key={purch.id}
                      onClick={() => onSelectPurchase?.(purch.id)}
                      className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {purch.providerName || 'Proveedor'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            #{purch.id.slice(-6)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{purch.date || formatLocalDate(purch.createdAt)}</span>
                          <span>•</span>
                          <span>{purch.totalItemsCount || purch.items?.length || 0} unidades</span>
                          <span>•</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            purch.paymentStatus === 'PAID' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : purch.paymentStatus === 'PARTIAL'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {purch.paymentStatus === 'PAID' ? 'Pagada' : purch.paymentStatus === 'PARTIAL' ? 'Pago Parcial' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <span className="font-mono font-black text-sm text-slate-900 block">
                            ${(purch.totalAmount || 0).toLocaleString('es-AR')}
                          </span>
                          {purch.pendingAmount && purch.pendingAmount > 0 ? (
                            <span className="text-[10px] text-rose-600 font-bold font-mono">
                              Debe: ${purch.pendingAmount.toLocaleString('es-AR')}
                            </span>
                          ) : null}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-colors" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 6. GASTOS OPERATIVOS VIEW */}
          {type === 'gastos_operativos' && (
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                Gastos operativos individuales ({traceability?.expenses?.length || 0})
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {(traceability?.expenses || [])
                  .filter((e) =>
                    !searchTerm ||
                    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    e.category.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((exp) => (
                    <div key={exp.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {exp.category}
                          </span>
                          <span className="font-bold text-xs text-slate-900">
                            {exp.description}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{exp.date}</span>
                          <span>•</span>
                          <span className="text-[10px] font-medium text-slate-600">
                            Origen: {exp.paidFrom === 'caja_general' ? 'Caja General' : exp.paidFrom === 'mercado_pago' ? 'Mercado Pago' : exp.paidFrom === 'transfer' ? 'Transferencia' : 'Caja Diaria'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-sm text-rose-700">
                          -${exp.amount.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 7. COSTO ESTIMADO & RESULTADO VIEW */}
          {type === 'costo_estimado' && (
            <div className="space-y-4">
              {/* Formula Card */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                  Fórmula del Resultado Estimado
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Facturación</span>
                    <span className="font-mono font-black text-white text-sm">
                      ${report.sales.totalRevenue.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">− Costo Estimado (CMV)</span>
                    <span className="font-mono font-black text-rose-400 text-sm">
                      -${report.estimatedResult.estimatedCogs.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">− Gastos Operativos</span>
                    <span className="font-mono font-black text-rose-400 text-sm">
                      -${report.estimatedResult.operatingExpenses.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/30 rounded-xl">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold block">= Resultado Comercial</span>
                    <span className={`font-mono font-black text-sm ${report.estimatedResult.estimatedResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${report.estimatedResult.estimatedResult.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informative Note */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">
                    Compras de mercadería ≠ Costo de mercadería vendida
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Las compras reponen stock y deuda con proveedores. El costo estimado mostrado abajo calcula exclusivamente las unidades efectivamente vendidas multiplicadas por el costo unitario de reposición de cada producto.
                  </p>
                </div>
              </div>

              {/* Warning if incomplete cost */}
              {report.estimatedResult.hasIncompleteCostData && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Atención: Hay productos vendidos sin costo registrado en catálogo. El costo estimado real podría ser superior.
                  </span>
                </div>
              )}

              {/* Products Table */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                  Productos vendidos y costo estimado ({traceability?.soldProductsWithCost?.length || 0})
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-2 text-center">Unidades</th>
                        <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                        <th className="py-2.5 px-3 text-right">Costo Total</th>
                        <th className="py-2.5 px-3 text-right">Venta Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(traceability?.soldProductsWithCost || []).map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50/70 font-sans">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            {!item.hasCost && (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded-full">
                                Sin costo registrado
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold font-mono">
                            {item.quantitySold}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {item.hasCost ? `$${item.unitCost.toLocaleString('es-AR')}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                            {item.hasCost ? `$${item.totalCost.toLocaleString('es-AR')}` : '$0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                            ${item.revenue.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
