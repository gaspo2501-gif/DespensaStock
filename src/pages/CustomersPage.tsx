import React, { useState, useEffect, useCallback } from 'react';
import { Customer, CreateCustomerInput } from '../types/customer';
import { customerService } from '../services/firebase/customerService';
import { accountService } from '../services/firebase/accountService';
import { CustomerFormModal } from '../components/customer/CustomerFormModal';
import { CustomerDetailModal } from '../components/customer/CustomerDetailModal';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  FileText, 
  Loader2, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  DollarSign, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal states
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  // Feedback message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [custList, balMap] = await Promise.all([
        customerService.getAllCustomers(),
        accountService.getAllBalances(),
      ]);
      setCustomers(custList);
      setBalances(balMap);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Save / Create Customer
  const handleSaveCustomer = async (data: CreateCustomerInput) => {
    if (editingCustomer) {
      const updated = await customerService.updateCustomer(editingCustomer.id, data);
      setFeedback({ type: 'success', message: `Cliente '${updated.name}' actualizado correctamente.` });
    } else {
      const created = await customerService.createCustomer(data);
      setFeedback({ type: 'success', message: `Cliente '${created.name}' creado con éxito.` });
    }
    setShowFormModal(false);
    setEditingCustomer(null);
    await loadData();
  };

  // Handle Delete Customer
  const handleDeleteCustomer = async (customer: Customer) => {
    const bal = balances[customer.id] || 0;
    if (bal > 0) {
      setFeedback({
        type: 'error',
        message: `No se puede eliminar a '${customer.name}' porque tiene una deuda pendiente de $${bal.toLocaleString('es-AR')}.`,
      });
      setDeletingCustomerId(null);
      return;
    }

    try {
      await customerService.deleteCustomer(customer.id);
      setFeedback({ type: 'success', message: `Cliente '${customer.name}' eliminado.` });
      setDeletingCustomerId(null);
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Error al eliminar cliente.' });
    }
  };

  // Filtered list
  const filteredCustomers = searchTerm.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.phone && c.phone.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : customers;

  return (
    <div className="space-y-5 animate-fadeIn max-w-4xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Clientes & Cuentas Corrientes</h1>
            <p className="text-xs text-slate-500 font-medium">Gestión de clientes y seguimiento de ventas fiadas</p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingCustomer(null);
            setShowFormModal(true);
          }}
          className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold text-slate-500 hover:text-slate-800">
            OK
          </button>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 shadow-2xs focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Cargando clientes de Firestore...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-3 shadow-2xs">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No hay clientes registrados</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Agregá tus clientes para habilitar ventas fiadas y llevar el control de cuenta corriente.
          </p>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setShowFormModal(true);
            }}
            className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Crear Primer Cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredCustomers.map((customer) => {
            const bal = balances[customer.id] || 0;

            return (
              <div
                key={customer.id}
                className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3 flex flex-col justify-between hover:border-emerald-200 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{customer.name}</h3>
                      {customer.phone && (
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{customer.phone}</span>
                        </p>
                      )}
                    </div>

                    {/* Balance badge */}
                    {bal > 0 ? (
                      <span className="text-xs font-black font-mono text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                        Deuda: ${bal.toLocaleString('es-AR')}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        Sin Deuda
                      </span>
                    )}
                  </div>

                  {customer.notes && (
                    <p className="text-[11px] text-slate-400 italic line-clamp-1 mt-2 flex items-center gap-1">
                      <FileText className="w-3 h-3 shrink-0" />
                      <span>{customer.notes}</span>
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingCustomer(customer);
                        setShowFormModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                      title="Editar cliente"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingCustomerId(customer.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Eliminar cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => setViewingCustomer(customer)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <span>Ficha / Cuenta</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Form Modal (Create / Edit) */}
      {showFormModal && (
        <CustomerFormModal
          isEditing={!!editingCustomer}
          initialData={editingCustomer}
          onSubmit={handleSaveCustomer}
          onCancel={() => {
            setShowFormModal(false);
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Customer Detail View Modal (Cuenta Corriente / Sales) */}
      {viewingCustomer && (
        <CustomerDetailModal
          customer={viewingCustomer}
          onClose={async () => {
            setViewingCustomer(null);
            await loadData();
          }}
          onEditCustomer={(c) => {
            setViewingCustomer(null);
            setEditingCustomer(c);
            setShowFormModal(true);
          }}
        />
      )}

      {/* Confirm Delete Customer Modal */}
      {deletingCustomerId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-slate-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">¿Eliminar cliente?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Se eliminará el perfil del cliente. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingCustomerId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const cust = customers.find((c) => c.id === deletingCustomerId);
                  if (cust) handleDeleteCustomer(cust);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
