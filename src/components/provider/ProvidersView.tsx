import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Phone, 
  FileText, 
  DollarSign, 
  ShoppingCart, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  Receipt, 
  UserPlus, 
  Check, 
  X,
  CreditCard,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { Provider, CreateProviderInput } from '../../types/provider';
import { providerService } from '../../services/firebase/providerService';
import { ProviderAccountModal } from './ProviderAccountModal';
import { SupplierPaymentModal } from './SupplierPaymentModal';

interface ProvidersViewProps {
  onSelectPurchase?: (purchaseId: string) => void;
  onNewPurchaseForProvider?: (provider: Provider) => void;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  onSelectPurchase,
  onNewPurchaseForProvider,
}) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [selectedProviderForAccount, setSelectedProviderForAccount] = useState<Provider | null>(null);
  const [selectedProviderForPayment, setSelectedProviderForPayment] = useState<Provider | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  // Form states
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const list = await providerService.getAllProvidersWithAccounts();
      setProviders(list);
    } catch (err) {
      console.warn('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleOpenCreate = () => {
    setEditingProvider(null);
    setFormName('');
    setFormPhone('');
    setFormNotes('');
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (p: Provider) => {
    setEditingProvider(p);
    setFormName(p.name);
    setFormPhone(p.phone || '');
    setFormNotes(p.notes || '');
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('El nombre o razón social es obligatorio');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingProvider) {
        await providerService.updateProvider(editingProvider.id, {
          name: formName.trim(),
          phone: formPhone.trim(),
          notes: formNotes.trim(),
        });
      } else {
        await providerService.saveProvider({
          name: formName.trim(),
          phone: formPhone.trim(),
          notes: formNotes.trim(),
        });
      }
      setShowCreateModal(false);
      await fetchProviders();
    } catch (err: any) {
      setFormError(err?.message || 'Error al guardar el proveedor');
    } finally {
      setIsSaving(false);
    }
  };

  // Totals
  const totalPurchasesGlobal = providers.reduce((acc, p) => acc + (p.totalPurchased || 0), 0);
  const totalPaidGlobal = providers.reduce((acc, p) => acc + (p.totalPaid || 0), 0);
  const totalDebtGlobal = providers.reduce((acc, p) => acc + (p.currentDebt || 0), 0);

  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.phone && p.phone.includes(searchTerm)) ||
    (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Top Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Proveedores & Cuentas</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Control de compras, pagos y saldos deudores de mercadería
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProviders}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-2xl border border-slate-700 transition-colors"
            title="Actualizar listado"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center gap-1.5 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Global Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
            Total Comprado Histórico
          </span>
          <p className="text-2xl font-black font-mono text-slate-900">
            ${totalPurchasesGlobal.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-slate-500">Mercadería total ingresada</p>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
            Total Pagado
          </span>
          <p className="text-2xl font-black font-mono text-emerald-700">
            ${totalPaidGlobal.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-slate-500">Pagos realizados a proveedores</p>
        </div>

        <div className={`p-4 rounded-2xl border shadow-2xs space-y-1 ${
          totalDebtGlobal > 0 ? 'bg-rose-50/70 border-rose-200 text-rose-900' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
        }`}>
          <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75">
            Saldo Pendiente Global (Deuda)
          </span>
          <p className={`text-2xl font-black font-mono ${totalDebtGlobal > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            ${totalDebtGlobal.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] opacity-80">
            {totalDebtGlobal > 0 ? 'Deuda total con proveedores' : 'Al día con todos los proveedores'}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          placeholder="Buscar proveedor por nombre, teléfono o notas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
        />
      </div>

      {/* Providers List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
          <span>Proveedores ({filteredProviders.length})</span>
          <span>Toca una tarjeta para abrir la cuenta corriente</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 space-y-3 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-bold">Cargando proveedores y cuentas...</p>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3 bg-white rounded-3xl border border-slate-200 p-6">
            <Building2 className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">
              {searchTerm ? 'No se encontraron proveedores con ese criterio.' : 'Aún no registraste proveedores.'}
            </p>
            <button
              onClick={handleOpenCreate}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Registrar Primer Proveedor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredProviders.map((p) => {
              const hasDebt = (p.currentDebt || 0) > 0;

              return (
                <div
                  key={p.id}
                  className="p-4 bg-white border border-slate-200/90 hover:border-indigo-300 rounded-3xl shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {p.name}
                        </h3>
                        {hasDebt ? (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                            Debe ${p.currentDebt?.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            Al día
                          </span>
                        )}
                      </div>

                      {p.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" /> {p.phone}
                        </p>
                      )}

                      {p.notes && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-1">{p.notes}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-700 p-1"
                      title="Editar datos"
                    >
                      Editar
                    </button>
                  </div>

                  {/* Financial Mini Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-2xl text-xs font-mono">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Comprado</span>
                      <span className="font-bold text-slate-900">${(p.totalPurchased || 0).toLocaleString('es-AR')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Pagado</span>
                      <span className="font-bold text-emerald-700">${(p.totalPaid || 0).toLocaleString('es-AR')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Saldo</span>
                      <span className={`font-bold ${hasDebt ? 'text-rose-700' : 'text-emerald-700'}`}>
                        ${(p.currentDebt || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-1 flex items-center gap-2 border-t border-slate-100">
                    <button
                      onClick={() => setSelectedProviderForAccount(p)}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ver Cuenta</span>
                    </button>

                    <button
                      onClick={() => setSelectedProviderForPayment(p)}
                      className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 shrink-0"
                      title="Registrar pago"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Pagar</span>
                    </button>

                    {onNewPurchaseForProvider && (
                      <button
                        onClick={() => onNewPurchaseForProvider(p)}
                        className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 shrink-0"
                        title="Nuevo ingreso de mercadería con este proveedor"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Comprar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account Statement Modal */}
      {selectedProviderForAccount && (
        <ProviderAccountModal
          providerId={selectedProviderForAccount.id}
          onClose={() => {
            setSelectedProviderForAccount(null);
            fetchProviders();
          }}
          onPurchaseClick={onSelectPurchase}
          onNewPurchase={(prov) => {
            setSelectedProviderForAccount(null);
            onNewPurchaseForProvider?.(prov);
          }}
        />
      )}

      {/* Direct Payment Modal */}
      {selectedProviderForPayment && (
        <SupplierPaymentModal
          providerId={selectedProviderForPayment.id}
          providerName={selectedProviderForPayment.name}
          pendingAmount={selectedProviderForPayment.currentDebt}
          onClose={() => {
            setSelectedProviderForPayment(null);
            fetchProviders();
          }}
          onPaymentSuccess={() => {
            fetchProviders();
          }}
        />
      )}

      {/* Create / Edit Provider Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold">
                  {editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProvider} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre / Razón Social <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Distribuidora Jaguar, Coca-Cola FEMSA..."
                  required
                  autoFocus
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" /> Teléfono / Contacto
                </label>
                <input
                  type="text"
                  placeholder="Ej: +54 9 11 1234-5678"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Días de reparto Martes y Jueves, vendedor Juan..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formName.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingProvider ? 'Guardar Cambios' : 'Crear Proveedor'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
