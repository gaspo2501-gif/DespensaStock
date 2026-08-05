import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Expense, 
  ExpenseCategory, 
  ExpensePaymentMethod, 
  EXPENSE_CATEGORIES, 
  EXPENSE_PAYMENT_METHODS, 
  CreateExpenseInput 
} from '../types/expense';
import { expenseService } from '../services/firebase/expenseService';
import { NumericInput } from '../components/common/NumericInput';
import { 
  Receipt, 
  Plus, 
  ArrowLeft, 
  RefreshCw, 
  DollarSign, 
  Calendar, 
  ShoppingBag, 
  Building2, 
  Trash2, 
  Edit3, 
  X, 
  Save, 
  Filter, 
  CheckCircle2, 
  AlertTriangle,
  Repeat,
  Wallet
} from 'lucide-react';

interface ExpensesPageProps {
  onBackToHome: () => void;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ onBackToHome }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [merchandisePurchasesToday, setMerchandisePurchasesToday] = useState<number>(0);
  const [merchandisePurchasesMonth, setMerchandisePurchasesMonth] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters state
  const [datePeriodFilter, setDatePeriodFilter] = useState<'today' | 'month' | 'all'>('month');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form field state
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('Electricidad');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<ExpensePaymentMethod>('cash');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formRecurrent, setFormRecurrent] = useState<boolean>(false);

  // Form error and submission states
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete confirmation modal state
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch expenses and merchandise purchases
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [expList, purchasesToday, purchasesMonth] = await Promise.all([
        expenseService.getExpenses(),
        expenseService.getMerchandisePurchases('today'),
        expenseService.getMerchandisePurchases('month'),
      ]);

      setExpenses(expList);
      setMerchandisePurchasesToday(purchasesToday);
      setMerchandisePurchasesMonth(purchasesMonth);
    } catch (err) {
      console.warn('Error al cargar gastos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculations for summary indicators
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthPrefix = useMemo(() => todayStr.substring(0, 7), [todayStr]);

  const todayExpensesSum = useMemo(() => {
    return expenses
      .filter((e) => e.date === todayStr)
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses, todayStr]);

  const monthExpensesSum = useMemo(() => {
    return expenses
      .filter((e) => e.date.startsWith(currentMonthPrefix))
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses, currentMonthPrefix]);

  const operationalExpensesSum = useMemo(() => {
    return expenses.reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const merchandisePurchasesSum = useMemo(() => {
    if (datePeriodFilter === 'today') return merchandisePurchasesToday;
    if (datePeriodFilter === 'month') return merchandisePurchasesMonth;
    return merchandisePurchasesMonth; // default total month merchandise
  }, [datePeriodFilter, merchandisePurchasesToday, merchandisePurchasesMonth]);

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // 1. Period filter
      if (datePeriodFilter === 'today' && e.date !== todayStr) return false;
      if (datePeriodFilter === 'month' && !e.date.startsWith(currentMonthPrefix)) return false;

      // 2. Category filter
      if (selectedCategoryFilter !== 'all' && e.category !== selectedCategoryFilter) return false;

      return true;
    });
  }, [expenses, datePeriodFilter, selectedCategoryFilter, todayStr, currentMonthPrefix]);

  // Reset modal form
  const openNewExpenseModal = () => {
    setEditingExpense(null);
    setFormCategory('Electricidad');
    setFormDescription('');
    setFormAmount(0);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPaymentMethod('cash');
    setFormNotes('');
    setFormRecurrent(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormCategory(exp.category);
    setFormDescription(exp.description);
    setFormAmount(exp.amount);
    setFormDate(exp.date);
    setFormPaymentMethod(exp.paymentMethod);
    setFormNotes(exp.notes || '');
    setFormRecurrent(exp.recurrent);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formDescription.trim()) {
      setFormError('Por favor ingresá un concepto o descripción del gasto.');
      return;
    }
    if (formAmount <= 0 || isNaN(formAmount)) {
      setFormError('Por favor ingresá un importe válido mayor a 0.');
      return;
    }

    setIsSubmitting(true);

    try {
      const inputData: CreateExpenseInput = {
        category: formCategory,
        description: formDescription.trim(),
        amount: formAmount,
        date: formDate,
        paymentMethod: formPaymentMethod,
        notes: formNotes.trim(),
        recurrent: formRecurrent,
      };

      if (editingExpense) {
        await expenseService.updateExpense(editingExpense.id, inputData);
      } else {
        await expenseService.createExpense(inputData);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el gasto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await expenseService.deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
      await loadData();
    } catch (err) {
      console.warn('Error al eliminar gasto:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getPaymentMethodBadge = (method: ExpensePaymentMethod) => {
    switch (method) {
      case 'cash':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">Efectivo</span>;
      case 'mercado_pago':
        return <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md font-bold text-[10px]">Mercado Pago</span>;
      case 'transfer':
        return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-bold text-[10px]">Transferencia</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">Otro</span>;
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto animate-fadeIn">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-full transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Inicio
        </button>

        <h1 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-rose-600" />
          Módulo de Gastos
        </h1>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors flex items-center justify-center"
          title="Actualizar datos"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 4. SUMMARY DASHBOARD CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Gastos de hoy */}
        <div className="p-4 bg-rose-700 text-white rounded-3xl shadow-md space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-100">
            <span className="text-[10px] font-black uppercase tracking-wider">Gastos de hoy</span>
            <DollarSign className="w-4 h-4 text-rose-300" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono">
              ${todayExpensesSum.toLocaleString('es-AR')}
            </div>
            <p className="text-[10px] text-rose-200 mt-0.5 font-medium">
              Registrados hoy
            </p>
          </div>
        </div>

        {/* Card 2: Gastos del mes */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider">Gastos del mes</span>
            <Calendar className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${monthExpensesSum.toLocaleString('es-AR')}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Mes en curso
            </p>
          </div>
        </div>

        {/* Card 3: Gastos operativos total */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider">Gastos operativos</span>
            <Receipt className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${operationalExpensesSum.toLocaleString('es-AR')}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Histórico acumulado
            </p>
          </div>
        </div>

        {/* Card 4: Compras de mercadería (del ingreso de mercadería) */}
        <div className="p-4 bg-white border border-indigo-200 bg-indigo-50/30 rounded-3xl shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-900">
            <span className="text-[10px] font-black uppercase tracking-wider">Compras Mercadería</span>
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-indigo-700">
              ${merchandisePurchasesSum.toLocaleString('es-AR')}
            </div>
            <p className="text-[10px] text-indigo-600/80 mt-0.5 font-semibold">
              Stock e Ingresos ({datePeriodFilter === 'today' ? 'Hoy' : 'Mes'})
            </p>
          </div>
        </div>
      </div>

      {/* 5. ACTION BUTTON & FILTERS BAR */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* New Expense Button */}
          <button
            onClick={openNewExpenseModal}
            className="py-3 px-5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            NUEVO GASTO
          </button>

          {/* Period Filter Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1">
            <button
              onClick={() => setDatePeriodFilter('today')}
              className={`flex-1 sm:flex-none py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all ${
                datePeriodFilter === 'today'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setDatePeriodFilter('month')}
              className={`flex-1 sm:flex-none py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all ${
                datePeriodFilter === 'month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setDatePeriodFilter('all')}
              className={`flex-1 sm:flex-none py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all ${
                datePeriodFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos
            </button>
          </div>
        </div>

        {/* Category Filter dropdown */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Categoría:
          </span>

          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 max-w-[200px]"
          >
            <option value="all">Todas las Categorías</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 14. EXPENSES LIST SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose-600" />
            Historial de Gastos
          </h2>

          <span className="text-xs font-semibold text-slate-400">
            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-xs font-bold text-slate-700">No hay gastos en este período</h3>
            <p className="text-[11px] text-slate-500">
              Presioná "+ NUEVO GASTO" para registrar el primer gasto operativo.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-300 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                      {expense.category}
                    </span>
                    {getPaymentMethodBadge(expense.paymentMethod)}
                    {expense.recurrent && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold text-[10px] flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> Recurrente
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{expense.description}</h3>
                  
                  {expense.notes && (
                    <p className="text-xs text-slate-500 italic">"{expense.notes}"</p>
                  )}

                  <p className="text-[11px] text-slate-400 font-mono">
                    Fecha: {new Date(expense.date + 'T12:00:00').toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </p>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                  <div className="text-base sm:text-lg font-black font-mono text-rose-700">
                    ${expense.amount.toLocaleString('es-AR')}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditExpenseModal(expense)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-colors"
                      title="Editar gasto"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpenseToDelete(expense)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Eliminar gasto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. FORM MODAL FOR CREATE / EDIT EXPENSE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-xl border border-slate-200 relative my-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">
                {editingExpense ? 'Modificar Registro' : 'Registrar Nuevo Gasto'}
              </span>
              <h2 className="text-lg font-black text-slate-900">
                {editingExpense ? 'Editar Gasto Operativo' : 'NUEVO GASTO'}
              </h2>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Categoría */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Categoría *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descripción / concepto */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Descripción / concepto *
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ej: Factura de luz Edesur, Alquiler del local..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                  required
                />
              </div>

              {/* Importe */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Importe *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono font-bold">$</span>
                  <NumericInput
                    min="0"
                    allowDecimal={true}
                    value={formAmount}
                    onChangeValue={(val) => setFormAmount(val)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-mono font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Monto monetario en pesos. Al hacer clic el valor se selecciona para reemplazo rápido.
                </p>
              </div>

              {/* Fecha & Forma de Pago (Row) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fecha */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                    required
                  />
                </div>

                {/* Forma de pago */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Forma de pago *
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as ExpensePaymentMethod)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                  >
                    {EXPENSE_PAYMENT_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Observaciones
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Detalles adicionales opcionales..."
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                />
              </div>

              {/* Gasto Recurrente Checkbox */}
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurrent-checkbox"
                  checked={formRecurrent}
                  onChange={(e) => setFormRecurrent(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded-md border-slate-300 focus:ring-rose-500"
                />
                <label htmlFor="recurrent-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Gasto recurrente (para programación futura)
                </label>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'GUARDANDO...' : editingExpense ? 'ACTUALIZAR GASTO' : 'GUARDAR GASTO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 17. DELETE CONFIRMATION MODAL */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl text-center border border-slate-200">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">¿Querés eliminar este gasto?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Se borrará el gasto <strong className="text-slate-800">"{expenseToDelete.description}"</strong> por <strong className="text-slate-800 font-mono">${expenseToDelete.amount.toLocaleString('es-AR')}</strong>. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setExpenseToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteExpense}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-2xl shadow-md"
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
