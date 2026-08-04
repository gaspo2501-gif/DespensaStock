import React, { useState, useEffect } from 'react';
import { Provider, CreateProviderInput } from '../../types/provider';
import { providerService } from '../../services/firebase/providerService';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  FileText, 
  Check, 
  X, 
  UserPlus, 
  Loader2,
  Building2
} from 'lucide-react';

interface ProviderModalProps {
  onSelectProvider: (provider: Provider) => void;
  onClose: () => void;
  selectedProviderId?: string;
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
  onSelectProvider,
  onClose,
  selectedProviderId,
}) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // New Provider Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const data = await providerService.getAllProviders();
      setProviders(data);
    } catch (err) {
      console.warn('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newName.trim()) {
      setError('El nombre del proveedor es obligatorio');
      return;
    }

    setIsSaving(true);
    try {
      const created = await providerService.saveProvider({
        name: newName.trim(),
        phone: newPhone.trim(),
        notes: newNotes.trim(),
      });
      setProviders((prev) => [created, ...prev]);
      onSelectProvider(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el proveedor');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Seleccionar Proveedor</h3>
              <p className="text-xs text-slate-400">Para el ingreso de mercadería</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form or Selector */}
        {showCreateForm ? (
          <form onSubmit={handleCreateProvider} className="p-5 space-y-4 overflow-y-auto flex-1">
            <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>Registrar Nuevo Proveedor / Distribuidora</span>
            </div>

            {error && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl">{error}</p>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nombre / Razón Social <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Distribuidora Los Andes"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                Teléfono / Contacto <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej: +54 9 11 1234-5678"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Notas / Observaciones <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Entregas los días Martes y Jueves"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || !newName.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Guardar y Usar
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 flex flex-col flex-1 min-h-0 overflow-hidden space-y-3">
            {/* Action Header */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => setShowCreateForm(true)}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                Nuevo
              </button>
            </div>

            {/* Providers List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs">Cargando proveedores...</p>
                </div>
              ) : filteredProviders.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-xs font-semibold text-slate-500">
                    {searchTerm ? 'No se encontraron proveedores' : 'Aún no hay proveedores registrados'}
                  </p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="py-2 px-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" /> Crear Proveedor
                  </button>
                </div>
              ) : (
                filteredProviders.map((p) => {
                  const isSelected = p.id === selectedProviderId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectProvider(p);
                        onClose();
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500'
                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                        {p.phone && (
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {p.phone}
                          </p>
                        )}
                        {p.notes && (
                          <p className="text-[11px] text-slate-400 italic line-clamp-1">{p.notes}</p>
                        )}
                      </div>

                      {isSelected && (
                        <span className="p-1.5 bg-indigo-600 text-white rounded-full">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
