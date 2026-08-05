import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  CashMovement, 
  CashClosure, 
  CashBalanceSummary, 
  CashPaymentMethod, 
  CashMovementType 
} from '../types/cash';
import { cashService } from '../services/firebase/cashService';
import { NumericInput } from '../components/common/NumericInput';
import { 
  Wallet, 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Smartphone, 
  Building2, 
  Calendar, 
  Filter, 
  Lock, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  X, 
  Check, 
  Loader2, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  PieChart
} from 'lucide-react';

export const CashPage: React.FC = () => {
  const [summary, setSummary] = useState<CashBalanceSummary>({
    cashBalance: 0,
    mercadoPagoBalance: 0,
    transferBalance: 0,
    otherBalance: 0,
    totalBalance: 0,
    todayIncome: 0,
    todayExpense: 0,
    todayNet: 0,
  });

  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [closures, setClosures] = useState<CashClosure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [showInitialModal, setShowInitialModal] = useState<boolean>(false);
  const [showClosureModal, setShowClosureModal] = useState<boolean>(false);
  const [showClosureHistory, setShowClosureHistory] = useState<boolean>(false);

  // Feedback message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for manual movement
  const [movType, setMovType] = useState<CashMovementType>('INCOME');
  const [movDescription, setMovDescription] = useState<string>('');
  const [movAmountStr, setMovAmountStr] = useState<string>('');
  const [movMethod, setMovMethod] = useState<CashPaymentMethod>('cash');
  const [movDate, setMovDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [movNotes, setMovNotes] = useState<string>('');
  const [isSubmittingMov, setIsSubmittingMov] = useState<boolean>(false);

  // Form states for initial balance
  const [initialAmountStr, setInitialAmountStr] = useState<string>('');
  const [initialDate, setInitialDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [initialNotes, setInitialNotes] = useState<string>('');
  const [isSubmittingInitial, setIsSubmittingInitial] = useState<boolean>(false);

  // Form states for closure
  const [countedCashStr, setCountedCashStr] = useState<string>('');
  const [closureNotes, setClosureNotes] = useState<string>('');
  const [isSubmittingClosure, setIsSubmittingClosure] = useState<boolean>(false);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, movs, clos] = await Promise.all([
        cashService.getCashSummary(),
        cashService.getCashMovements(),
        cashService.getCashClosures(),
      ]);
      setSummary(sum);
      setMovements(movs);
      setClosures(clos);
    } catch (err) {
      console.error('Error al cargar datos de caja:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle create manual movement
  const handleSaveManualMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(movAmountStr);
    if (!movDescription.trim()) {
      setFeedback({ type: 'error', message: 'Ingresá un concepto o descripción para el movimiento.' });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setFeedback({ type: 'error', message: 'Ingresá un importe mayor a $0.' });
      return;
    }

    setIsSubmittingMov(true);
    try {
      await cashService.createCashMovement({
        type: movType,
        amount,
        paymentMethod: movMethod,
        description: movDescription.trim(),
        date: movDate,
        sourceType: 'MANUAL',
        sourceId: `manual_${Date.now()}`,
        notes: movNotes.trim(),
      });

      setFeedback({ type: 'success', message: `Movimiento de $${amount.toLocaleString('es-AR')} registrado con éxito.` });
      setShowManualModal(false);
      // Reset form
      setMovDescription('');
      setMovAmountStr('');
      setMovNotes('');
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al registrar el movimiento.' });
    } finally {
      setIsSubmittingMov(false);
    }
  };

  // Handle set initial balance
  const handleSaveInitialBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(initialAmountStr);
    if (isNaN(amount) || amount < 0) {
      setFeedback({ type: 'error', message: 'Ingresá un monto válido para el saldo inicial.' });
      return;
    }

    setIsSubmittingInitial(true);
    try {
      await cashService.setInitialBalance(amount, initialDate, initialNotes.trim());
      setFeedback({ type: 'success', message: `Saldo inicial establecido en $${amount.toLocaleString('es-AR')}.` });
      setShowInitialModal(false);
      setInitialAmountStr('');
      setInitialNotes('');
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al establecer el saldo inicial.' });
    } finally {
      setIsSubmittingInitial(false);
    }
  };

  // Handle save cash closure
  const handleSaveClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    const countedCash = parseFloat(countedCashStr);
    if (isNaN(countedCash) || countedCash < 0) {
      setFeedback({ type: 'error', message: 'Ingresá el monto de dinero físico contado.' });
      return;
    }

    setIsSubmittingClosure(true);
    try {
      const closure = await cashService.createCashClosure(summary.cashBalance, countedCash, closureNotes.trim());
      const diffText = closure.difference === 0 
        ? 'Caja exacta' 
        : closure.difference > 0 
          ? `Sobrante: +$${closure.difference.toLocaleString('es-AR')}` 
          : `Faltante: -$${Math.abs(closure.difference).toLocaleString('es-AR')}`;

      setFeedback({ type: 'success', message: `Cierre de caja guardado con éxito. (${diffText})` });
      setShowClosureModal(false);
      setCountedCashStr('');
      setClosureNotes('');
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al guardar el cierre de caja.' });
    } finally {
      setIsSubmittingClosure(false);
    }
  };

  // Filtered movements calculation
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get date 7 days ago
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get date 1st of month
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return movements.filter((mov) => {
      // 1. Period filter
      if (periodFilter === 'today' && mov.date !== todayStr) return false;
      if (periodFilter === 'yesterday' && mov.date !== yesterdayStr) return false;
      if (periodFilter === 'week' && new Date(mov.date) < weekAgo) return false;
      if (periodFilter === 'month' && new Date(mov.date) < firstOfMonth) return false;

      // 2. Method filter
      if (methodFilter !== 'all' && mov.paymentMethod !== methodFilter) return false;

      // 3. Type filter
      if (typeFilter !== 'all' && mov.type !== typeFilter) return false;

      return true;
    });
  }, [movements, periodFilter, methodFilter, typeFilter]);

  // Method badges helper
  const renderMethodBadge = (method: CashPaymentMethod) => {
    switch (method) {
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            <span>Efectivo</span>
          </span>
        );
      case 'mercado_pago':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
            <Smartphone className="w-3 h-3 text-sky-600" />
            <span>Mercado Pago</span>
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
            <Building2 className="w-3 h-3 text-indigo-600" />
            <span>Transferencia</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            <Wallet className="w-3 h-3 text-slate-500" />
            <span>Otro</span>
          </span>
        );
    }
  };

  // Source badges helper
  const renderSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'SALE':
        return <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">Venta</span>;
      case 'CUSTOMER_PAYMENT':
        return <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">Pago Cliente</span>;
      case 'EXPENSE':
        return <span className="text-[10px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-md">Gasto</span>;
      default:
        return <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md">Manual</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto pb-10">
      {/* Page Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-inner">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Caja & Arqueo</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Consolidación y control de movimientos de efectivo, Mercado Pago y transferencias
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowInitialModal(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-2xl transition-all border border-slate-700 flex items-center gap-1.5"
            title="Establecer saldo inicial"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Saldo Inicial</span>
          </button>

          <button
            onClick={() => {
              setCountedCashStr(summary.cashBalance.toString());
              setShowClosureModal(true);
            }}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Cerrar Caja</span>
          </button>

          <button
            onClick={() => {
              setMovType('INCOME');
              setMovDescription('');
              setMovAmountStr('');
              setShowManualModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl shadow-lg transition-all flex items-center gap-1.5 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>+ Movimiento</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
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

      {/* Main Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Efectivo */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Saldo en Efectivo</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-emerald-700">
              ${summary.cashBalance.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Caja física esperada</p>
          </div>
        </div>

        {/* Mercado Pago */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 relative overflow-hidden group hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Mercado Pago</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-sky-700">
              ${summary.mercadoPagoBalance.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Cuenta MP consolidada</p>
          </div>
        </div>

        {/* Transferencias */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 relative overflow-hidden group hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Transferencias</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-indigo-700">
              ${summary.transferBalance.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Banco / Cuentas digitales</p>
          </div>
        </div>

        {/* Saldo Total */}
        <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Saldo Total</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 text-emerald-400 flex items-center justify-center font-bold">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-white">
              ${summary.totalBalance.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Suma de todos los medios</p>
          </div>
        </div>
      </div>

      {/* Today's Summary Card */}
      <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Resumen del Día (Hoy)</h2>
          </div>
          <span className="text-xs font-bold text-slate-400 font-mono">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center justify-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> Ingresos Hoy
            </p>
            <p className="text-lg font-black font-mono text-emerald-700">
              +${summary.todayIncome.toLocaleString('es-AR')}
            </p>
          </div>

          <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 flex items-center justify-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" /> Egresos Hoy
            </p>
            <p className="text-lg font-black font-mono text-rose-700">
              -${summary.todayExpense.toLocaleString('es-AR')}
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
              Flujo Neto Hoy
            </p>
            <p className={`text-lg font-black font-mono ${summary.todayNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {summary.todayNet >= 0 ? '+' : ''}${summary.todayNet.toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Movement History Section */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">Historial de Movimientos</h2>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {filteredMovements.length}
            </span>
          </div>

          <button
            onClick={() => setShowClosureHistory(true)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Ver Arqueos / Cierres Previos ({closures.length})</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Period filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setPeriodFilter('today')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                periodFilter === 'today' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriodFilter('yesterday')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                periodFilter === 'yesterday' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ayer
            </button>
            <button
              onClick={() => setPeriodFilter('week')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                periodFilter === 'week' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setPeriodFilter('month')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                periodFilter === 'month' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                periodFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Payment Method filter dropdown */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Medio: Todos</option>
            <option value="cash">Efectivo</option>
            <option value="mercado_pago">Mercado Pago</option>
            <option value="transfer">Transferencia</option>
            <option value="other">Otro</option>
          </select>

          {/* Type filter dropdown */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Tipo: Todos</option>
            <option value="INCOME">Solo Ingresos (+)</option>
            <option value="EXPENSE">Solo Egresos (-)</option>
          </select>
        </div>

        {/* Movements List Table */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Cargando movimientos de caja...</p>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Wallet className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Sin movimientos para el filtro seleccionado</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Probá cambiar el periodo o registrar un nuevo movimiento de caja.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMovements.map((mov) => {
              const isIncome = mov.type === 'INCOME';

              return (
                <div
                  key={mov.id}
                  className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    {/* Icon indicator */}
                    <div
                      className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-white font-black shadow-xs ${
                        isIncome ? 'bg-emerald-600' : 'bg-rose-500'
                      }`}
                    >
                      {isIncome ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{mov.description}</span>
                        {renderSourceBadge(mov.sourceType)}
                        {renderMethodBadge(mov.paymentMethod)}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>{mov.date}</span>
                        {mov.notes && <span>• {mov.notes}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-base font-black font-mono ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {isIncome ? '+' : '-'}${mov.amount.toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal 1: + Movimiento Manual */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[88dvh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Registrar Movimiento Manual</h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                disabled={isSubmittingMov}
                className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualMovement} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Income vs Expense Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Movimiento <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovType('INCOME')}
                    className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      movType === 'INCOME'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>INGRESO (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovType('EXPENSE')}
                    className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      movType === 'EXPENSE'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                    <span>EGRESO (-)</span>
                  </button>
                </div>
              </div>

              {/* Concepto / Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Concepto / Descripción <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Retiro del dueño / Cambio inicial / Pago repartidor"
                  value={movDescription}
                  onChange={(e) => setMovDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Importe */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Importe ($) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">$</span>
                  <NumericInput
                    min="0.01"
                    step="any"
                    allowDecimal={true}
                    required
                    value={movAmountStr}
                    onChangeRaw={(e) => setMovAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Forma de Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Forma de Pago <span className="text-rose-500">*</span>
                </label>
                <select
                  value={movMethod}
                  onChange={(e) => setMovMethod(e.target.value as CashPaymentMethod)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="cash">Efectivo</option>
                  <option value="mercado_pago">Mercado Pago</option>
                  <option value="transfer">Transferencia</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Fecha <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={movDate}
                  onChange={(e) => setMovDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
                  value={movNotes}
                  onChange={(e) => setMovNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  disabled={isSubmittingMov}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMov}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmittingMov ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Registrar Movimiento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Saldo Inicial */}
      {showInitialModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[88dvh]">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-sm">Establecer Saldo Inicial de Caja</h3>
              </div>
              <button
                onClick={() => setShowInitialModal(false)}
                disabled={isSubmittingInitial}
                className="p-1.5 text-emerald-200 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInitialBalance} className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 leading-relaxed font-medium">
                Esta acción creará un ingreso manual especial con la descripción <strong>"Saldo inicial de caja"</strong> para iniciar el control de efectivo desde la fecha indicada.
              </div>

              {/* Monto Inicial */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Monto Inicial de Efectivo ($) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">$</span>
                  <NumericInput
                    min="0"
                    step="any"
                    allowDecimal={true}
                    required
                    autoFocus
                    value={initialAmountStr}
                    onChangeRaw={(e) => setInitialAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Fecha de Apertura <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={initialDate}
                  onChange={(e) => setInitialDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Apertura de turno mañana / Arqueo de prueba"
                  value={initialNotes}
                  onChange={(e) => setInitialNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInitialModal(false)}
                  disabled={isSubmittingInitial}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInitial}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmittingInitial ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Estableciendo...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar Saldo Inicial</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Cierre de Caja */}
      {showClosureModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[88dvh]">
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-300" />
                <h3 className="font-bold text-sm">Arqueo y Cierre de Caja</h3>
              </div>
              <button
                onClick={() => setShowClosureModal(false)}
                disabled={isSubmittingClosure}
                className="p-1.5 text-indigo-200 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClosure} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Expected Balance Card */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Saldo Esperado en Efectivo
                </span>
                <p className="text-2xl font-black font-mono text-emerald-400">
                  ${summary.cashBalance.toLocaleString('es-AR')}
                </p>
                <p className="text-[11px] text-slate-400">
                  Calculado de ventas, cobros, gastos y saldo inicial
                </p>
              </div>

              {/* Physical Counted Cash Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dinero Físico Contado ($) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">$</span>
                  <NumericInput
                    min="0"
                    step="any"
                    allowDecimal={true}
                    required
                    autoFocus
                    value={countedCashStr}
                    onChangeRaw={(e) => setCountedCashStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Difference Status Banner */}
              {(() => {
                const counted = parseFloat(countedCashStr) || 0;
                const diff = counted - summary.cashBalance;

                if (diff === 0) {
                  return (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>🟢 Caja exacta: El dinero contado coincide con el saldo esperado.</span>
                    </div>
                  );
                } else if (diff > 0) {
                  return (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>🟢 Sobrante de caja:</span>
                      </div>
                      <span className="font-mono font-black text-sm text-emerald-700">
                        +${diff.toLocaleString('es-AR')}
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs font-bold text-rose-800">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>🔴 Faltante de caja:</span>
                      </div>
                      <span className="font-mono font-black text-sm text-rose-700">
                        -${Math.abs(diff).toLocaleString('es-AR')}
                      </span>
                    </div>
                  );
                }
              })()}

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones del Cierre <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cierre de turno tarde / Sin novedades"
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowClosureModal(false)}
                  disabled={isSubmittingClosure}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClosure}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmittingClosure ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Confirmar Cierre</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Historial de Cierres */}
      {showClosureHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Historial de Cierres de Caja</h3>
              </div>
              <button
                onClick={() => setShowClosureHistory(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {closures.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Lock className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Sin cierres de caja registrados</p>
                  <p className="text-xs text-slate-400">
                    Los cierres de caja realizados quedarán asentados aquí.
                  </p>
                </div>
              ) : (
                closures.map((c) => {
                  const dateFormatted = new Date(c.createdAt).toLocaleString('es-AR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });

                  return (
                    <div
                      key={c.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span className="text-xs font-bold text-slate-700 font-mono">{dateFormatted}</span>
                        {c.difference === 0 ? (
                          <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                            Exacta
                          </span>
                        ) : c.difference > 0 ? (
                          <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md font-mono">
                            Sobrante +${c.difference.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md font-mono">
                            Faltante -${Math.abs(c.difference).toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                        <div>
                          <span className="text-[10px] font-sans text-slate-400 uppercase font-extrabold block">Esperado</span>
                          <span className="font-bold text-slate-900">${c.expectedCash.toLocaleString('es-AR')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-sans text-slate-400 uppercase font-extrabold block">Contado</span>
                          <span className="font-bold text-slate-900">${c.countedCash.toLocaleString('es-AR')}</span>
                        </div>
                      </div>

                      {c.notes && (
                        <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/50">
                          {c.notes}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowClosureHistory(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
