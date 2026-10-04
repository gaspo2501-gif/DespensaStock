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
import { CashMovementDetailModal } from '../components/modals/CashMovementDetailModal';
import { CashClosureDetailModal } from '../components/modals/CashClosureDetailModal';
import { SaleDetailModal } from '../components/modals/SaleDetailModal';
import { ExpenseDetailModal } from '../components/modals/ExpenseDetailModal';
import { PaymentDetailModal } from '../components/modals/PaymentDetailModal';
import { useLocation } from '../context/LocationContext';
import { getLocationName } from '../types/location';
import { 
  formatLocalDate, 
  formatLocalDateTime,
  toArgentinaDateString, 
  getArgentinaToday, 
  getArgentinaYesterday, 
  getArgentinaDaysAgo, 
  getArgentinaFirstOfMonth 
} from '../utils/dateUtils';
import { ExpensesPage } from './ExpensesPage';
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
  ChevronDown,
  PieChart,
  ExternalLink,
  ArrowLeftRight,
  Receipt,
  Store,
  UserCheck
} from 'lucide-react';

interface CashPageProps {
  initialSubTab?: 'movements' | 'expenses' | 'closures';
}

export const CashPage: React.FC<CashPageProps> = ({ initialSubTab = 'movements' }) => {
  const { currentLocation } = useLocation();
  const [activeSubTab, setActiveSubTab] = useState<'movements' | 'expenses' | 'closures'>(initialSubTab);
  const [summary, setSummary] = useState<CashBalanceSummary>({
    cashBalance: 0,
    mercadoPagoBalance: 0,
    transferBalance: 0,
    otherBalance: 0,
    totalBalance: 0,
    todayIncome: 0,
    todayExpense: 0,
    todayNet: 0,
    todaySales: 0,
    todayCash: 0,
    todayMercadoPago: 0,
    todayTransfer: 0,
    todayOther: 0,
  });

  const [showHistoricalBalances, setShowHistoricalBalances] = useState<boolean>(false);

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
  const [selectedMovementForDetail, setSelectedMovementForDetail] = useState<CashMovement | null>(null);
  const [selectedClosureForDetail, setSelectedClosureForDetail] = useState<CashClosure | null>(null);
  const [linkedSaleId, setLinkedSaleId] = useState<string | null>(null);
  const [linkedExpenseId, setLinkedExpenseId] = useState<string | null>(null);
  const [linkedPaymentId, setLinkedPaymentId] = useState<string | null>(null);

  // Feedback message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for manual movement
  const [movType, setMovType] = useState<CashMovementType>('INCOME');
  const [movDescription, setMovDescription] = useState<string>('');
  const [movAmountStr, setMovAmountStr] = useState<string>('');
  const [movMethod, setMovMethod] = useState<CashPaymentMethod>('cash');
  const [movFund, setMovFund] = useState<'caja_diaria' | 'caja_general' | 'mercado_pago' | 'transfer'>('caja_diaria');
  const [movDate, setMovDate] = useState<string>(getArgentinaToday());
  const [movNotes, setMovNotes] = useState<string>('');
  const [isSubmittingMov, setIsSubmittingMov] = useState<boolean>(false);

  // Form states for initial balance
  const [initialAmountStr, setInitialAmountStr] = useState<string>('');
  const [initialDate, setInitialDate] = useState<string>(getArgentinaToday());
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
        cashService.getCashSummary(currentLocation),
        cashService.getCashMovements(currentLocation),
        cashService.getCashClosures(currentLocation),
      ]);
      setSummary(sum);
      setMovements(movs);
      setClosures(clos);
    } catch (err) {
      console.error('Error al cargar datos de caja:', err);
    } finally {
      setLoading(false);
    }
  }, [currentLocation]);

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
      const pm: CashPaymentMethod = movFund === 'mercado_pago' ? 'mercado_pago' : movFund === 'transfer' ? 'transfer' : 'cash';
      const crType = movFund === 'caja_general' ? 'caja_general' : movFund === 'caja_diaria' ? 'caja_diaria' : undefined;

      await cashService.createCashMovement({
        type: movType,
        amount,
        paymentMethod: pm,
        description: movDescription.trim(),
        date: movDate,
        sourceType: 'MANUAL',
        sourceId: `manual_${Date.now()}`,
        notes: movNotes.trim(),
        cashRegisterType: crType,
        paidFrom: movFund,
        locationId: currentLocation,
      }, currentLocation);

      setFeedback({ type: 'success', message: `Movimiento de $${amount.toLocaleString('es-AR')} registrado con éxito.` });
      setShowManualModal(false);
      // Reset form
      setMovDescription('');
      setMovAmountStr('');
      setMovNotes('');
      setMovFund('caja_diaria');
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

  // Form states for transfer to Caja General
  const [showTransferToGeneralModal, setShowTransferToGeneralModal] = useState<boolean>(false);
  const [transferAmountStr, setTransferAmountStr] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);

  // Form states for general cash movement
  const [showGeneralMovementModal, setShowGeneralMovementModal] = useState<boolean>(false);
  const [generalMovType, setGeneralMovType] = useState<CashMovementType>('INCOME');
  const [generalMovDesc, setGeneralMovDesc] = useState<string>('');
  const [generalMovAmountStr, setGeneralMovAmountStr] = useState<string>('');
  const [generalMovNotes, setGeneralMovNotes] = useState<string>('');
  const [isSubmittingGeneralMov, setIsSubmittingGeneralMov] = useState<boolean>(false);

  // Handle save cash closure
  const handleSaveClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    const countedCash = parseFloat(countedCashStr);
    if (isNaN(countedCash) || countedCash < 0) {
      setFeedback({ type: 'error', message: 'Ingresá el monto de dinero físico contado.' });
      return;
    }

    const expectedCash = summary.dailyExpectedCash !== undefined ? summary.dailyExpectedCash : summary.cashBalance;

    setIsSubmittingClosure(true);
    try {
      const closure = await cashService.createCashClosure(expectedCash, countedCash, closureNotes.trim(), currentLocation);
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

  // Handle transfer to Caja General
  const handleSaveTransferToGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmountStr);
    if (isNaN(amount) || amount <= 0) {
      setFeedback({ type: 'error', message: 'Ingresá un importe válido mayor a $0.' });
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      await cashService.transferToCajaGeneral(amount, transferNotes.trim(), currentLocation);
      setFeedback({ type: 'success', message: `Pase de $${amount.toLocaleString('es-AR')} a Caja General realizado con éxito.` });
      setShowTransferToGeneralModal(false);
      setTransferAmountStr('');
      setTransferNotes('');
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al transferir a Caja General.' });
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Handle direct movement in Caja General
  const handleSaveGeneralMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(generalMovAmountStr);
    if (!generalMovDesc.trim()) {
      setFeedback({ type: 'error', message: 'Ingresá un concepto para el movimiento.' });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setFeedback({ type: 'error', message: 'Ingresá un importe mayor a $0.' });
      return;
    }

    setIsSubmittingGeneralMov(true);
    try {
      await cashService.createGeneralCashMovement({
        type: generalMovType,
        amount,
        description: generalMovDesc.trim(),
        notes: generalMovNotes.trim(),
        locationId: currentLocation,
      });
      setFeedback({ type: 'success', message: `Movimiento de Caja General ($${amount.toLocaleString('es-AR')}) registrado con éxito.` });
      setShowGeneralMovementModal(false);
      setGeneralMovDesc('');
      setGeneralMovAmountStr('');
      setGeneralMovNotes('');
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al registrar movimiento en Caja General.' });
    } finally {
      setIsSubmittingGeneralMov(false);
    }
  };

  // Filtered movements calculation
  const filteredMovements = useMemo(() => {
    const todayStr = getArgentinaToday();
    const yesterdayStr = getArgentinaYesterday();
    const weekAgoStr = getArgentinaDaysAgo(7);
    const firstOfMonthStr = getArgentinaFirstOfMonth();

    return movements.filter((mov) => {
      // 1. Period filter (always using Argentina calendar date)
      const movDate = mov.date || toArgentinaDateString(mov.createdAt) || todayStr;
      if (periodFilter === 'today' && movDate !== todayStr) return false;
      if (periodFilter === 'yesterday' && movDate !== yesterdayStr) return false;
      if (periodFilter === 'week' && movDate < weekAgoStr) return false;
      if (periodFilter === 'month' && movDate < firstOfMonthStr) return false;

      // 2. Method filter
      if (methodFilter !== 'all' && mov.paymentMethod !== methodFilter) return false;

      // 3. Type filter
      if (typeFilter === 'INCOME' && (mov.type !== 'INCOME' || mov.paymentMethod === 'credit')) return false;
      if (typeFilter === 'EXPENSE' && mov.type !== 'EXPENSE') return false;
      if (typeFilter === 'CREDIT' && mov.paymentMethod !== 'credit') return false;

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
      case 'credit':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            <UserCheck className="w-3 h-3 text-amber-600" />
            <span>Fiado / Cta. Cte.</span>
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
        return <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Venta</span>;
      case 'CUSTOMER_PAYMENT':
        return <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">Cobro Cta. Cte.</span>;
      case 'EXPENSE':
        return <span className="text-[10px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">Gasto</span>;
      default:
        return <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">Manual</span>;
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
              const expected = summary.dailyExpectedCash !== undefined ? summary.dailyExpectedCash : summary.cashBalance;
              setCountedCashStr(expected.toString());
              setShowClosureModal(true);
            }}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Cerrar Caja Diaria</span>
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

      {/* SUB-NAVIGATION TABS: Movimientos | Gastos | Cierres */}
      <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
        <button
          onClick={() => setActiveSubTab('movements')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'movements'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Movimientos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('expenses')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'expenses'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Gastos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('closures')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'closures'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Cierres ({closures.length})</span>
        </button>
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

      {/* SUB-TAB 2: GASTOS EMBEDDED */}
      {activeSubTab === 'expenses' && (
        <div className="animate-fadeIn">
          <ExpensesPage isEmbedded={true} onBackToHome={() => setActiveSubTab('movements')} />
        </div>
      )}

      {/* SUB-TAB 3: CIERRES DIRECT VIEW */}
      {activeSubTab === 'closures' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Arqueos y Cierres de Caja</h2>
                  <p className="text-xs text-slate-500">Historial completo de arqueos y balances finales</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setCountedCashStr(summary.cashBalance.toString());
                  setShowClosureModal(true);
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Lock className="w-4 h-4" />
                <span>Realizar Cierre de Caja</span>
              </button>
            </div>

            {closures.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Lock className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Sin cierres de caja registrados</p>
                <p className="text-xs text-slate-400">
                  Al pulsar "Realizar Cierre de Caja" los arqueos quedarán asentados aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {closures.map((c) => {
                  const dateFormatted = formatLocalDateTime(c.createdAt || c.date);

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClosureForDetail(c)}
                      className="p-4 bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl space-y-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                      title="Hacé clic para ver el arqueo detallado"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 font-mono transition-colors">{dateFormatted}</span>
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md">
                            {getLocationName(c.locationId as any || 'aimogasta')}
                          </span>
                        </div>
                        {c.status === 'CANCELLED' ? (
                          <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                            ANULADO
                          </span>
                        ) : c.difference === 0 ? (
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

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] font-sans text-slate-400 uppercase font-extrabold block">Esperado</span>
                          <span className="font-bold text-slate-900">${c.expectedCash.toLocaleString('es-AR')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-sans text-slate-400 uppercase font-extrabold block">Contado</span>
                          <span className="font-bold text-slate-900">${c.countedCash.toLocaleString('es-AR')}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between">
                        {c.notes ? (
                          <p className="text-[11px] text-slate-500 italic truncate max-w-[200px]">
                            {c.notes}
                          </p>
                        ) : <span />}
                        <span className="text-[10px] font-bold text-indigo-600 group-hover:underline flex items-center gap-0.5 ml-auto">
                          <span>Ver arqueo</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 1: MOVIMIENTOS & BALANCES VIEW */}
      {activeSubTab === 'movements' && (
        <div className="space-y-6 animate-fadeIn">

          {/* ========================================================================= */}
          {/* SECCIÓN PRINCIPAL: CAJA DIARIA vs CAJA GENERAL                            */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. CAJA DIARIA DEL LOCAL */}
            <div className="p-5 bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-3xl shadow-lg border border-emerald-700/50 flex flex-col justify-between space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <DollarSign className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300">
                        Caja Diaria (Local)
                      </h2>
                      <p className="text-[11px] text-slate-300">
                        Dinero físico en cajón • Inicia en $0 cada día
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                    Físico Hoy
                  </span>
                </div>

                <div className="p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-xs space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 block">
                    Efectivo Esperado en Caja Hoy
                  </span>
                  <p className="text-3xl font-black font-mono text-emerald-300 tracking-tight">
                    ${(summary.dailyExpectedCash || 0).toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    ¿Cuánto efectivo debería haber físicamente ahora en el cajón?
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-black/20 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block">Ingresos Efectivo</span>
                    <span className="font-mono font-bold text-emerald-400">+${(summary.dailyCashIncome || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="p-2.5 bg-black/20 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block">Egresos Efectivo</span>
                    <span className="font-mono font-bold text-rose-400">-${(summary.dailyCashExpense || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="p-2.5 bg-black/20 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block">Pases a C. Gral</span>
                    <span className="font-mono font-bold text-amber-300">-${(summary.dailyTransfersToGeneral || 0).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-white/10">
                <button
                  onClick={() => {
                    const expected = summary.dailyExpectedCash !== undefined ? summary.dailyExpectedCash : summary.cashBalance;
                    setCountedCashStr(expected.toString());
                    setShowClosureModal(true);
                  }}
                  className="flex-1 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Cerrar Caja Diaria (Arqueo)</span>
                </button>
                <button
                  onClick={() => setShowTransferToGeneralModal(true)}
                  className="py-2.5 px-3 bg-white/15 hover:bg-white/25 active:scale-98 text-white font-bold text-xs rounded-xl transition-all border border-white/20 flex items-center justify-center gap-1.5 shrink-0"
                  title="Pasar recaudación del día a la Caja General"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Retirar a Caja General</span>
                </button>
              </div>
            </div>

            {/* 2. CAJA GENERAL (ACUMULATIVA) */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                      <Building2 className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                        Caja General
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Recaudación general acumulativa y reservas
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                    Acumulado
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    Total Disponible (Todos los fondos)
                  </span>
                  <p className="text-3xl font-black font-mono text-slate-900 tracking-tight">
                    ${(summary.totalBalance || 0).toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Suma consolidada de efectivo general, cuentas digitales y bancos
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                    <span className="text-[9px] uppercase font-extrabold text-slate-400 block">Efectivo General</span>
                    <span className="font-mono font-black text-slate-900 block text-xs truncate">
                      ${(summary.cajaGeneralBalance || 0).toLocaleString('es-AR')}
                    </span>
                    <span className="text-[9px] text-slate-400">Fondos / Caja fuerte</span>
                  </div>

                  <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-100 space-y-0.5">
                    <span className="text-[9px] uppercase font-extrabold text-sky-700 block">Mercado Pago</span>
                    <span className="font-mono font-black text-sky-800 block text-xs truncate">
                      ${(summary.mercadoPagoBalance || 0).toLocaleString('es-AR')}
                    </span>
                    <span className="text-[9px] text-sky-600/80">Saldo disponible MP</span>
                  </div>

                  <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-0.5 col-span-2 sm:col-span-1">
                    <span className="text-[9px] uppercase font-extrabold text-indigo-700 block">Transferencias / Bancos</span>
                    <span className="font-mono font-black text-indigo-800 block text-xs truncate">
                      ${(summary.transferBalance || 0).toLocaleString('es-AR')}
                    </span>
                    <span className="text-[9px] text-indigo-600/80">Cuentas bancarias</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Retiros de ganancias y movimientos de fondos
                </span>
                <button
                  onClick={() => setShowGeneralMovementModal(true)}
                  className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Movimiento Caja General</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Balances Grid (Balance del Día) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Efectivo Hoy */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Efectivo Hoy</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-emerald-700">
              {summary.todayCash >= 0 ? '+' : ''}${summary.todayCash.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Dinero neto en efectivo del día</p>
          </div>
        </div>

        {/* Mercado Pago Hoy */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 relative overflow-hidden group hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Mercado Pago Hoy</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-sky-700">
              {summary.todayMercadoPago >= 0 ? '+' : ''}${summary.todayMercadoPago.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Dinero neto digital MP del día</p>
          </div>
        </div>

        {/* Transferencias Hoy */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 relative overflow-hidden group hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Transferencias Hoy</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-indigo-700">
              {summary.todayTransfer >= 0 ? '+' : ''}${summary.todayTransfer.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Dinero neto transferencias del día</p>
          </div>
        </div>

        {/* Balance del Día */}
        <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Balance del Día</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 text-emerald-400 flex items-center justify-center font-bold">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-white">
              {summary.todayNet >= 0 ? '+' : ''}${summary.todayNet.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Movimiento financiero neto del día</p>
          </div>
        </div>
      </div>

      {/* Panel discreto de consulta: Saldos Acumulados Históricos (para Arqueo de Caja) */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowHistoricalBalances(!showHistoricalBalances)}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors self-start"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showHistoricalBalances ? 'rotate-180' : ''}`} />
            <span>{showHistoricalBalances ? 'Ocultar saldos acumulados de caja' : 'Ver saldos acumulados de caja (para arqueos y cierres)'}</span>
          </button>
          <div className="text-[11px] font-mono text-slate-500 font-medium">
            Saldo acumulado total: <strong className="text-slate-800">${summary.totalBalance.toLocaleString('es-AR')}</strong>
          </div>
        </div>

        {showHistoricalBalances && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5 border-t border-slate-200/70 animate-fadeIn text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Efectivo Acumulado</span>
              <span className="text-sm font-black font-mono text-emerald-700">${summary.cashBalance.toLocaleString('es-AR')}</span>
              <p className="text-[10px] text-slate-400">Caja física esperada</p>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Mercado Pago Acumulado</span>
              <span className="text-sm font-black font-mono text-sky-700">${summary.mercadoPagoBalance.toLocaleString('es-AR')}</span>
              <p className="text-[10px] text-slate-400">Cuenta digital MP</p>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Transferencias Acumuladas</span>
              <span className="text-sm font-black font-mono text-indigo-700">${summary.transferBalance.toLocaleString('es-AR')}</span>
              <p className="text-[10px] text-slate-400">Banco / Cuentas digitales</p>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Total Acumulado</span>
              <span className="text-sm font-black font-mono text-slate-900">${summary.totalBalance.toLocaleString('es-AR')}</span>
              <p className="text-[10px] text-slate-400">Todos los medios</p>
            </div>
          </div>
        )}
      </div>

      {/* Today's Summary Card */}
      <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Resumen del Día (Hoy)</h2>
          </div>
          <span className="text-xs font-bold text-slate-400 font-mono">
            {formatLocalDate(getArgentinaToday())}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800 flex items-center justify-center gap-1">
              <Store className="w-3.5 h-3.5 text-blue-600" /> Ventas Hoy
            </p>
            <p className="text-lg font-black font-mono text-blue-700">
              ${summary.todaySales.toLocaleString('es-AR')}
            </p>
            <p className="text-[10px] text-blue-600/80 font-medium">Actividad comercial</p>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center justify-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> Ingresos Hoy
            </p>
            <p className="text-lg font-black font-mono text-emerald-700">
              +${summary.todayIncome.toLocaleString('es-AR')}
            </p>
            <p className="text-[10px] text-emerald-600/80 font-medium">Dinero ingresado</p>
          </div>

          <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 flex items-center justify-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" /> Egresos Hoy
            </p>
            <p className="text-lg font-black font-mono text-rose-700">
              -${summary.todayExpense.toLocaleString('es-AR')}
            </p>
            <p className="text-[10px] text-rose-600/80 font-medium">Gastos operativos</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
              Flujo Neto Hoy
            </p>
            <p className={`text-lg font-black font-mono ${summary.todayNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {summary.todayNet >= 0 ? '+' : ''}${summary.todayNet.toLocaleString('es-AR')}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Balance en caja</p>
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
            <option value="credit">Fiado / Cta. Cte.</option>
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
            <option value="CREDIT">Solo Fiados (Cta. Cte.)</option>
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
              const isFiado = mov.paymentMethod === 'credit';

              return (
                <div
                  key={mov.id}
                  onClick={() => {
                    if (mov.sourceType === 'SALE') {
                      setLinkedSaleId(mov.sourceId);
                    } else if (mov.sourceType === 'CUSTOMER_PAYMENT') {
                      setLinkedPaymentId(mov.sourceId);
                    } else {
                      setSelectedMovementForDetail(mov);
                    }
                  }}
                  className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white hover:border-emerald-300 hover:shadow-xs transition-all shadow-2xs cursor-pointer group"
                  title="Hacé clic para ver el detalle completo de este movimiento"
                >
                  <div className="flex items-center gap-3">
                    {/* Icon indicator */}
                    {isFiado ? (
                      <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-amber-800 bg-amber-100/90 border border-amber-200 shadow-xs font-black">
                        <Receipt className="w-5 h-5 text-amber-700" />
                      </div>
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-white font-black shadow-xs ${
                          isIncome ? 'bg-emerald-600' : 'bg-rose-500'
                        }`}
                      >
                        {isIncome ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                      </div>
                    )}

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">{mov.description}</span>
                        {renderSourceBadge(mov.sourceType)}
                        {renderMethodBadge(mov.paymentMethod)}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>{formatLocalDateTime(mov.createdAt || mov.date)}</span>
                        {mov.notes && <span>• {mov.notes}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0">
                    {isFiado ? (
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block sm:inline-block">
                          FIADO (Sin ingreso)
                        </span>
                        <p className="text-base font-black font-mono text-slate-700 sm:mt-0.5">
                          ${mov.amount.toLocaleString('es-AR')}
                        </p>
                      </div>
                    ) : (
                      <p className={`text-base font-black font-mono ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {isIncome ? '+' : '-'}${mov.amount.toLocaleString('es-AR')}
                      </p>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold group-hover:text-emerald-600 flex items-center gap-0.5 transition-colors">
                      <span>Ver detalle</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )}

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

              {/* Origen / Destino de los Fondos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Origen / Destino del Dinero <span className="text-rose-500">*</span>
                </label>
                <select
                  value={movFund}
                  onChange={(e) => {
                    const f = e.target.value as 'caja_diaria' | 'caja_general' | 'mercado_pago' | 'transfer';
                    setMovFund(f);
                    if (f === 'mercado_pago') setMovMethod('mercado_pago');
                    else if (f === 'transfer') setMovMethod('transfer');
                    else setMovMethod('cash');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="caja_diaria">Caja Diaria (efectivo del cajón de hoy)</option>
                  <option value="caja_general">Caja General (efectivo acumulado / reservas)</option>
                  <option value="mercado_pago">Mercado Pago (cuenta digital)</option>
                  <option value="transfer">Transferencia / Banco</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {movFund === 'caja_diaria'
                    ? 'Afecta el efectivo físico diario del cajón de hoy.'
                    : movFund === 'caja_general'
                    ? 'Afecta la reserva acumulativa general de la empresa.'
                    : 'Afecta la cuenta digital o bancaria seleccionada.'}
                </p>
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
              {(() => {
                const expectedCash = summary.dailyExpectedCash !== undefined ? summary.dailyExpectedCash : summary.cashBalance;
                const counted = parseFloat(countedCashStr) || 0;
                const diff = counted - expectedCash;

                return (
                  <>
                    <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Efectivo Esperado en Caja Diaria
                        </span>
                        <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                          {getLocationName(currentLocation)}
                        </span>
                      </div>
                      <p className="text-3xl font-black font-mono text-emerald-400">
                        ${expectedCash.toLocaleString('es-AR')}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Dinero físico que debería haber en el cajón hoy (inicia en $0 cada día)
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
                    {diff === 0 ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>🟢 Caja exacta: El dinero contado coincide con el saldo esperado ($0 diferencia).</span>
                      </div>
                    ) : diff > 0 ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>🟢 Sobrante de caja:</span>
                        </div>
                        <span className="font-mono font-black text-sm text-emerald-700">
                          +${diff.toLocaleString('es-AR')}
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs font-bold text-rose-800">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                          <span>🔴 Faltante de caja:</span>
                        </div>
                        <span className="font-mono font-black text-sm text-rose-700">
                          -${Math.abs(diff).toLocaleString('es-AR')}
                        </span>
                      </div>
                    )}
                  </>
                );
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
                  const dateFormatted = formatLocalDateTime(c.createdAt || c.date);

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClosureForDetail(c)}
                      className="p-4 bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl space-y-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                      title="Hacé clic para ver el arqueo detallado"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 font-mono transition-colors">{dateFormatted}</span>
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md">
                            {getLocationName(c.locationId as any || 'aimogasta')}
                          </span>
                        </div>
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

                      <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between">
                        {c.notes ? (
                          <p className="text-[11px] text-slate-500 italic truncate max-w-[200px]">
                            {c.notes}
                          </p>
                        ) : <span />}
                        <span className="text-[10px] font-bold text-indigo-600 group-hover:underline flex items-center gap-0.5 ml-auto">
                          <span>Ver arqueo</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
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

      {/* MODAL: TRANSFER TO CAJA GENERAL */}
      {showTransferToGeneralModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[88dvh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Retirar a Caja General</h3>
              </div>
              <button
                onClick={() => setShowTransferToGeneralModal(false)}
                disabled={isSubmittingTransfer}
                className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransferToGeneral} className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 leading-relaxed space-y-1">
                <p className="font-bold">Pase interno de recaudación:</p>
                <p className="text-[11px] text-emerald-800">
                  Descuenta el dinero del efectivo físico diario del cajón y lo suma al saldo disponible de Caja General (fondos generales o caja fuerte). No genera gastos operativos ni altera ventas.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Importe a Retirar ($) <span className="text-rose-500">*</span>
                  </label>
                  {summary.dailyExpectedCash > 0 && (
                    <button
                      type="button"
                      onClick={() => setTransferAmountStr(summary.dailyExpectedCash.toString())}
                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      Todo el cajón (${summary.dailyExpectedCash.toLocaleString('es-AR')})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">$</span>
                  <NumericInput
                    min="0.01"
                    step="any"
                    allowDecimal={true}
                    required
                    autoFocus
                    value={transferAmountStr}
                    onChangeRaw={(e) => setTransferAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones / Motivo <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cierre de jornada, pase a caja fuerte"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTransferToGeneralModal(false)}
                  disabled={isSubmittingTransfer}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmittingTransfer ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transfiriendo...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Pase</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MOVEMENT IN CAJA GENERAL */}
      {showGeneralMovementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[88dvh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Movimiento en Caja General</h3>
              </div>
              <button
                onClick={() => setShowGeneralMovementModal(false)}
                disabled={isSubmittingGeneralMov}
                className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGeneralMovement} className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Movimiento <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGeneralMovType('INCOME')}
                    className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      generalMovType === 'INCOME'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>INGRESO (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneralMovType('EXPENSE')}
                    className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      generalMovType === 'EXPENSE'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                    <span>RETIRO / EGRESO (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Concepto / Descripción <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Retiro de ganancias del negocio / Aporte de capital"
                  value={generalMovDesc}
                  onChange={(e) => setGeneralMovDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

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
                    value={generalMovAmountStr}
                    onChangeRaw={(e) => setGeneralMovAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
                  value={generalMovNotes}
                  onChange={(e) => setGeneralMovNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowGeneralMovementModal(false)}
                  disabled={isSubmittingGeneralMov}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGeneralMov}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmittingGeneralMov ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Registrar en Caja General</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CASH MOVEMENT DETAIL MODAL */}
      {selectedMovementForDetail && (
        <CashMovementDetailModal
          movement={selectedMovementForDetail}
          onClose={() => setSelectedMovementForDetail(null)}
          onOpenSaleDetail={(saleId) => setLinkedSaleId(saleId)}
          onOpenExpenseDetail={(expenseId) => setLinkedExpenseId(expenseId)}
          onOpenPaymentDetail={(paymentId) => setLinkedPaymentId(paymentId)}
          onOperationCancelled={loadData}
        />
      )}

      {/* CASH CLOSURE DETAIL MODAL */}
      {selectedClosureForDetail && (
        <CashClosureDetailModal
          closure={selectedClosureForDetail}
          onClose={() => setSelectedClosureForDetail(null)}
          onOperationCancelled={loadData}
        />
      )}

      {/* LINKED SALE DETAIL MODAL */}
      {linkedSaleId && (
        <SaleDetailModal
          saleId={linkedSaleId}
          onClose={() => setLinkedSaleId(null)}
          onOperationCancelled={loadData}
        />
      )}

      {/* LINKED EXPENSE DETAIL MODAL */}
      {linkedExpenseId && (
        <ExpenseDetailModal
          expenseId={linkedExpenseId}
          onClose={() => setLinkedExpenseId(null)}
          onOperationCancelled={loadData}
        />
      )}

      {/* LINKED PAYMENT DETAIL MODAL */}
      {linkedPaymentId && (
        <PaymentDetailModal
          movementId={linkedPaymentId}
          onClose={() => setLinkedPaymentId(null)}
          onOperationCancelled={loadData}
        />
      )}
    </div>
  );
};
