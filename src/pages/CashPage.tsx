import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  CashMovement, 
  CashClosure, 
  CashBalanceSummary, 
  CashPaymentMethod, 
  CashMovementType 
} from '../types/cash';
import { cashService, resolveMovementFund } from '../services/firebase/cashService';
import { expenseService } from '../services/firebase/expenseService';
import { ExpenseCategory, ExpensePaidFrom, EXPENSE_CATEGORIES, EXPENSE_PAID_FROM_OPTIONS } from '../types/expense';
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
  const [activeMainTab, setActiveMainTab] = useState<'caja_diaria' | 'caja_general' | 'expenses'>(
    initialSubTab === 'expenses' ? 'expenses' : initialSubTab === 'closures' ? 'caja_general' : 'caja_diaria'
  );
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
    dailyExpectedCash: 0,
    dailyCashIncome: 0,
    dailyCashExpense: 0,
    dailyTransfersToGeneral: 0,
    cajaGeneralBalance: 0,
  });

  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [closures, setClosures] = useState<CashClosure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quick expense form states
  const [showQuickExpenseModal, setShowQuickExpenseModal] = useState<boolean>(false);
  const [quickExpDesc, setQuickExpDesc] = useState<string>('');
  const [quickExpAmountStr, setQuickExpAmountStr] = useState<string>('');
  const [quickExpCategory, setQuickExpCategory] = useState<ExpenseCategory>('Otros');
  const [quickExpPaidFrom, setQuickExpPaidFrom] = useState<ExpensePaidFrom>('caja_diaria');
  const [quickExpNotes, setQuickExpNotes] = useState<string>('');
  const [isSubmittingQuickExp, setIsSubmittingQuickExp] = useState<boolean>(false);

  // Filters for Caja Diaria Movimientos
  const [todaySearch, setTodaySearch] = useState<string>('');
  const [todayMethodFilter, setTodayMethodFilter] = useState<string>('all');

  // Filters for Caja General Movimientos
  const [genPeriodFilter, setGenPeriodFilter] = useState<'all' | 'today' | 'month'>('all');
  const [genFundFilter, setGenFundFilter] = useState<'all' | 'caja_general' | 'mercado_pago' | 'transfer'>('all');
  const [genTypeFilter, setGenTypeFilter] = useState<'all' | 'SUPPLIER_PAYMENT' | 'EXPENSE' | 'MANUAL' | 'INTERNAL_TRANSFER'>('all');
  const [genSearch, setGenSearch] = useState<string>('');

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

  // Handle quick expense
  const handleSaveQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(quickExpAmountStr);
    if (!quickExpDesc.trim()) {
      setFeedback({ type: 'error', message: 'Ingresá un concepto o descripción para el gasto.' });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setFeedback({ type: 'error', message: 'Ingresá un importe mayor a $0.' });
      return;
    }

    setIsSubmittingQuickExp(true);
    try {
      const pm: CashPaymentMethod = quickExpPaidFrom === 'mercado_pago' ? 'mercado_pago' : quickExpPaidFrom === 'transfer' ? 'transfer' : 'cash';

      await expenseService.createExpense({
        category: quickExpCategory,
        description: quickExpDesc.trim(),
        amount,
        paymentMethod: pm,
        paidFrom: quickExpPaidFrom,
        date: getArgentinaToday(),
        notes: quickExpNotes.trim(),
        locationId: currentLocation,
        recurrent: false,
      });

      const fundLabel = quickExpPaidFrom === 'caja_diaria' ? 'Caja Diaria' : quickExpPaidFrom === 'caja_general' ? 'Caja General' : quickExpPaidFrom === 'mercado_pago' ? 'Mercado Pago' : 'Transferencia';
      setFeedback({ type: 'success', message: `Gasto de $${amount.toLocaleString('es-AR')} (${quickExpDesc.trim()}) registrado desde ${fundLabel}.` });
      setShowQuickExpenseModal(false);
      setQuickExpDesc('');
      setQuickExpAmountStr('');
      setQuickExpNotes('');
      setQuickExpPaidFrom('caja_diaria');
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al registrar el gasto.' });
    } finally {
      setIsSubmittingQuickExp(false);
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

    const expectedCash = summary.dailyExpectedCash !== undefined ? summary.dailyExpectedCash : summary.cashBalance;

    setIsSubmittingClosure(true);
    try {
      const closure = await cashService.createCashClosure(
        expectedCash, 
        countedCash, 
        closureNotes.trim(), 
        currentLocation,
        {
          cashCollected: summary.dailyCashIncome || 0,
          mercadoPagoCollected: summary.todayMercadoPago > 0 ? summary.todayMercadoPago : 0,
          transferCollected: summary.todayTransfer > 0 ? summary.todayTransfer : 0,
          totalCollected: (summary.dailyCashIncome || 0) + (summary.todayMercadoPago > 0 ? summary.todayMercadoPago : 0) + (summary.todayTransfer > 0 ? summary.todayTransfer : 0)
        }
      );
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

  const todayStr = getArgentinaToday();
  const currentMonthStr = getArgentinaFirstOfMonth();

  // 1. MOVIMIENTOS DE HOY (para Caja Diaria)
  const todayMovements = useMemo(() => {
    return movements
      .filter((mov) => {
        const movDate = mov.date || toArgentinaDateString(mov.createdAt) || todayStr;
        if (movDate !== todayStr) return false;

        if (todayMethodFilter !== 'all') {
          const fund = resolveMovementFund(mov);
          if (todayMethodFilter === 'cash' && mov.paymentMethod !== 'cash') return false;
          if (todayMethodFilter === 'mercado_pago' && mov.paymentMethod !== 'mercado_pago') return false;
          if (todayMethodFilter === 'transfer' && mov.paymentMethod !== 'transfer') return false;
          if (todayMethodFilter === 'credit' && mov.paymentMethod !== 'credit') return false;
          if (todayMethodFilter === 'caja_diaria' && fund !== 'caja_diaria') return false;
        }

        if (todaySearch.trim()) {
          const q = todaySearch.toLowerCase();
          const desc = (mov.description || '').toLowerCase();
          const notes = (mov.notes || '').toLowerCase();
          const prov = (mov.providerName || '').toLowerCase();
          const cust = (mov.customerName || '').toLowerCase();
          if (!desc.includes(q) && !notes.includes(q) && !prov.includes(q) && !cust.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime();
        const timeB = new Date(b.createdAt || b.date).getTime();
        return timeB - timeA;
      });
  }, [movements, todayStr, todayMethodFilter, todaySearch]);

  // 2. TOTAL DISPONIBLE (para Caja General: exactamente la suma de los 3 fondos)
  const generalCash = summary.cajaGeneralBalance || 0;
  const mpBalance = summary.mercadoPagoBalance || 0;
  const transferBalance = summary.transferBalance || 0;
  const totalDisponible = generalCash + mpBalance + transferBalance;

  // 3. MOVIMIENTOS / EGRESOS DE CAJA GENERAL
  const generalMovements = useMemo(() => {
    return movements.filter((mov) => {
      if (mov.sourceType === 'INTERNAL_TRANSFER') return true;
      if (mov.sourceType === 'SUPPLIER_PAYMENT') return true;
      const fund = resolveMovementFund(mov);
      return fund === 'caja_general' || fund === 'mercado_pago' || fund === 'transfer';
    });
  }, [movements]);

  const filteredGeneralMovements = useMemo(() => {
    return generalMovements
      .filter((mov) => {
        const movDate = mov.date || toArgentinaDateString(mov.createdAt) || todayStr;
        if (genPeriodFilter === 'today' && movDate !== todayStr) return false;
        if (genPeriodFilter === 'month' && movDate < currentMonthStr) return false;

        if (genFundFilter !== 'all') {
          const fund = resolveMovementFund(mov);
          if (fund !== genFundFilter) return false;
        }

        if (genTypeFilter !== 'all') {
          if (mov.sourceType !== genTypeFilter) return false;
        }

        if (genSearch.trim()) {
          const q = genSearch.toLowerCase();
          const desc = (mov.description || '').toLowerCase();
          const notes = (mov.notes || '').toLowerCase();
          const prov = (mov.providerName || '').toLowerCase();
          if (!desc.includes(q) && !notes.includes(q) && !prov.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime();
        const timeB = new Date(b.createdAt || b.date).getTime();
        return timeB - timeA;
      });
  }, [generalMovements, genPeriodFilter, genFundFilter, genTypeFilter, genSearch, todayStr, currentMonthStr]);

  // Fund badges helper
  const renderFundBadge = (mov: CashMovement) => {
    const fund = resolveMovementFund(mov);
    if (fund === 'caja_general') {
      return (
        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
          Caja General
        </span>
      );
    }
    if (fund === 'caja_diaria' && mov.paymentMethod === 'cash') {
      return (
        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
          Caja Diaria
        </span>
      );
    }
    return null;
  };

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
            onClick={() => setShowQuickExpenseModal(true)}
            className="px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center gap-1.5 active:scale-98"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Registrar Gasto</span>
          </button>

          <button
            onClick={() => {
              const expected = summary.dailyExpectedCash !== undefined ? summary.dailyExpectedCash : summary.cashBalance;
              setCountedCashStr(expected.toString());
              setShowClosureModal(true);
            }}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center gap-1.5 active:scale-98"
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

      {/* NAVEGACIÓN PRINCIPAL: CAJA DIARIA | CAJA GENERAL | GASTOS */}
      <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
        <button
          onClick={() => setActiveMainTab('caja_diaria')}
          className={`flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeMainTab === 'caja_diaria'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4 stroke-[2.5]" />
          <span>Caja Diaria (Hoy)</span>
        </button>

        <button
          onClick={() => setActiveMainTab('caja_general')}
          className={`flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeMainTab === 'caja_general'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 stroke-[2.5]" />
          <span>Caja General ({closures.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('expenses')}
          className={`py-3 px-3.5 sm:px-5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeMainTab === 'expenses'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Gastos</span>
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

      {/* ========================================================================= */}
      {/* VISTA 1: CAJA DIARIA (OPERATORIA DE HOY)                                   */}
      {/* ========================================================================= */}
      {activeMainTab === 'caja_diaria' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Tarjeta Protagonista: Caja Diaria */}
          <div className="p-6 bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 text-white rounded-3xl shadow-xl border border-emerald-700/40 relative overflow-hidden space-y-5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-inner shrink-0">
                  <DollarSign className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-emerald-300">
                    Caja Diaria
                  </h2>
                  <p className="text-xs text-slate-300">
                    Operatoria del día actual • Inicia en $0 cada jornada ({formatLocalDate(todayStr)})
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider self-start sm:self-auto font-mono">
                {getLocationName(currentLocation)}
              </span>
            </div>

            {/* Número Protagonista: Efectivo Esperado en Caja */}
            <div className="p-5 bg-white/10 rounded-2xl border border-white/15 backdrop-blur-xs space-y-1.5 relative z-10">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-200/90 block">
                Efectivo Esperado en Caja
              </span>
              <p className="text-4xl sm:text-5xl font-black font-mono text-emerald-300 tracking-tight">
                ${(summary.dailyExpectedCash || 0).toLocaleString('es-AR')}
              </p>
              <p className="text-xs text-slate-300 font-medium">
                ¿Cuánto efectivo debería haber físicamente ahora mismo en el cajón?
              </p>
            </div>

            {/* Pequeño Desglose Subordinado (solo entradas y salidas al cajón) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs relative z-10">
              <div className="p-3 bg-black/25 rounded-2xl border border-white/5 space-y-0.5">
                <span className="text-[10px] uppercase font-extrabold text-slate-400 block">
                  Entradas al Cajón
                </span>
                <span className="font-mono font-bold text-sm text-emerald-400 block">
                  +${(summary.dailyCashIncome || 0).toLocaleString('es-AR')}
                </span>
                <span className="text-[10px] text-slate-400">Ventas y cobros efectivo</span>
              </div>

              <div className="p-3 bg-black/25 rounded-2xl border border-white/5 space-y-0.5">
                <span className="text-[10px] uppercase font-extrabold text-slate-400 block">
                  Salidas del Cajón
                </span>
                <span className="font-mono font-bold text-sm text-rose-400 block">
                  -${(summary.dailyCashExpense || 0).toLocaleString('es-AR')}
                </span>
                <span className="text-[10px] text-slate-400">Gastos pagados con efectivo</span>
              </div>

              <div className="p-3 bg-black/25 rounded-2xl border border-white/5 space-y-0.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-extrabold text-slate-400 block">
                  Pases a Caja General
                </span>
                <span className="font-mono font-bold text-sm text-amber-300 block">
                  -${(summary.dailyTransfersToGeneral || 0).toLocaleString('es-AR')}
                </span>
                <span className="text-[10px] text-slate-400">Retirado a fondos generales</span>
              </div>
            </div>

            {/* Acciones Rápidas de Caja Diaria */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5 relative z-10 border-t border-white/10">
              <button
                onClick={() => setShowQuickExpenseModal(true)}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-4 h-4" />
                <span>Registrar Gasto</span>
              </button>

              <button
                onClick={() => {
                  const expected = summary.dailyExpectedCash !== undefined ? summary.dailyExpectedCash : summary.cashBalance;
                  setCountedCashStr(expected.toString());
                  setShowClosureModal(true);
                }}
                className="py-2.5 px-4 bg-emerald-400 hover:bg-emerald-300 active:scale-98 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Lock className="w-4 h-4 stroke-[2.5]" />
                <span>Cerrar Caja Diaria / Arqueo</span>
              </button>

              <button
                onClick={() => setShowTransferToGeneralModal(true)}
                className="py-2.5 px-3.5 bg-white/15 hover:bg-white/25 active:scale-98 text-white font-bold text-xs rounded-xl transition-all border border-white/20 flex items-center justify-center gap-1.5 ml-auto"
                title="Pasar recaudación del día a la Caja General"
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-300" />
                <span>Retirar a Caja General</span>
              </button>
            </div>
          </div>

          {/* HISTORIAL DE CAJA DIARIA: MOVIMIENTOS DE HOY */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                      Movimientos de Hoy
                    </h3>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {todayMovements.length} operaciones
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Toda la operatoria registrada hoy ({formatLocalDate(todayStr)})
                  </p>
                </div>
              </div>
            </div>

            {/* Filtros para Movimientos de Hoy */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar por concepto, cliente, proveedor u observación..."
                  value={todaySearch}
                  onChange={(e) => setTodaySearch(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {todaySearch && (
                  <button
                    onClick={() => setTodaySearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={todayMethodFilter}
                onChange={(e) => setTodayMethodFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Medio de Pago: Todos</option>
                <option value="cash">Solo Efectivo</option>
                <option value="mercado_pago">Solo Mercado Pago</option>
                <option value="transfer">Solo Transferencia</option>
                <option value="credit">Solo Fiados / Cta. Cte.</option>
                <option value="caja_diaria">Solo los que afectan el cajón</option>
              </select>
            </div>

            {/* Listado de Movimientos de Hoy */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-500">Cargando movimientos de hoy...</p>
              </div>
            ) : todayMovements.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Wallet className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Sin movimientos registrados hoy</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Aún no se han asentado ventas, cobros ni gastos durante la jornada de hoy.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayMovements.map((mov) => {
                  const isIncome = mov.type === 'INCOME';
                  const isFiado = mov.paymentMethod === 'credit';
                  const fund = resolveMovementFund(mov);
                  const affectsDrawer = fund === 'caja_diaria';

                  return (
                    <div
                      key={mov.id}
                      onClick={() => {
                        if (mov.sourceType === 'SALE') {
                          setLinkedSaleId(mov.sourceId);
                        } else if (mov.sourceType === 'CUSTOMER_PAYMENT') {
                          setLinkedPaymentId(mov.sourceId);
                        } else if (mov.sourceType === 'EXPENSE') {
                          setLinkedExpenseId(mov.sourceId);
                        } else {
                          setSelectedMovementForDetail(mov);
                        }
                      }}
                      className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white hover:border-emerald-300 hover:shadow-xs transition-all shadow-2xs cursor-pointer group"
                      title="Hacé clic para ver el detalle de este movimiento"
                    >
                      <div className="flex items-center gap-3">
                        {/* Icono de Tipo */}
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

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {mov.description}
                            </span>
                            {renderSourceBadge(mov.sourceType)}
                            {renderMethodBadge(mov.paymentMethod)}

                            {/* Badge de Impacto en el Cajón */}
                            {isFiado ? (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                Fiado (Sin ingreso)
                              </span>
                            ) : affectsDrawer ? (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Afecta cajón físico
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                No afecta cajón físico
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono flex-wrap">
                            <span>{formatLocalDateTime(mov.createdAt || mov.date)}</span>
                            {mov.customerName && (
                              <span className="text-slate-600 font-sans font-medium">
                                • Cliente: <strong>{mov.customerName}</strong>
                              </span>
                            )}
                            {mov.providerName && (
                              <span className="text-slate-600 font-sans font-medium">
                                • Proveedor: <strong>{mov.providerName}</strong>
                              </span>
                            )}
                            {mov.notes && (
                              <span className="text-slate-500 font-sans italic truncate max-w-xs">
                                • {mov.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0">
                        {isFiado ? (
                          <div className="text-right">
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

      {/* ========================================================================= */}
      {/* VISTA 2: CAJA GENERAL (FONDOS ACUMULADOS & CIERRES)                        */}
      {/* ========================================================================= */}
      {activeMainTab === 'caja_general' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Bloque Superior: CAJA GENERAL & TOTAL DISPONIBLE */}
          <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200 shrink-0">
                  <Building2 className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
                    Caja General
                  </h2>
                  <p className="text-xs text-slate-500">
                    Dinero acumulado y disponible en el negocio
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGeneralMovementModal(true)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-98"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Movimiento Caja General</span>
                </button>
                <button
                  onClick={() => setShowTransferToGeneralModal(true)}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 active:scale-98"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Ingresar desde Diaria</span>
                </button>
              </div>
            </div>

            {/* TOTAL DISPONIBLE (Protagonista Grande) */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-md space-y-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 block">
                Total Disponible
              </span>
              <p className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight">
                ${totalDisponible.toLocaleString('es-AR')}
              </p>
              <p className="text-xs text-slate-300 font-medium">
                Suma consolidada de efectivo acumulado, cuenta digital de Mercado Pago y transferencias bancarias.
              </p>
            </div>

            {/* COMPOSICIÓN DE FONDOS (Exactamente 3 tarjetas, sin duplicados) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* 1. Efectivo General */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black text-slate-500">
                    Efectivo General
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black font-mono text-slate-900">
                  ${generalCash.toLocaleString('es-AR')}
                </p>
                <p className="text-[11px] text-slate-400">Fondos acumulados / Caja fuerte</p>
              </div>

              {/* 2. Mercado Pago */}
              <div className="p-4 bg-sky-50/70 rounded-2xl border border-sky-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black text-sky-800">
                    Mercado Pago
                  </span>
                  <Smartphone className="w-4 h-4 text-sky-600" />
                </div>
                <p className="text-2xl font-black font-mono text-sky-900">
                  ${mpBalance.toLocaleString('es-AR')}
                </p>
                <p className="text-[11px] text-sky-700/80">Saldo disponible en cuenta digital MP</p>
              </div>

              {/* 3. Transferencias / Banco */}
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black text-indigo-800">
                    Transferencias / Banco
                  </span>
                  <Building2 className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-black font-mono text-indigo-900">
                  ${transferBalance.toLocaleString('es-AR')}
                </p>
                <p className="text-[11px] text-indigo-700/80">Cuentas bancarias y depósitos</p>
              </div>
            </div>
          </div>

          {/* HISTORIAL DE CIERRES EN CAJA GENERAL */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    Historial de Cierres
                  </h3>
                  <p className="text-xs text-slate-400">
                    Consolidación de recaudación en Caja General y arqueos de caja
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full self-start sm:self-auto">
                {closures.length} cierres registrados
              </span>
            </div>

            {closures.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Lock className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Sin cierres de caja registrados aún</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Al pulsar "Cerrar Caja Diaria" en la operatoria de hoy, la recaudación consolidada aparecerá aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {closures.map((c) => {
                  const dateFormatted = formatLocalDateTime(c.createdAt || c.date);
                  const cashColl = c.cashCollected !== undefined ? c.cashCollected : c.expectedCash;
                  const mpColl = c.mercadoPagoCollected !== undefined ? c.mercadoPagoCollected : 0;
                  const trColl = c.transferCollected !== undefined ? c.transferCollected : 0;
                  const totColl = c.totalCollected !== undefined ? c.totalCollected : (c.countedCash || c.expectedCash);

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClosureForDetail(c)}
                      className="p-4 bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl space-y-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                      title="Hacé clic para ver el arqueo detallado"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 font-mono transition-colors">
                            {dateFormatted}
                          </span>
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
                            Arqueo Exacto
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

                      {/* Recaudación Consolidada */}
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-[10px] uppercase text-slate-500 font-extrabold">Recaudación Consolidada</span>
                          <span className="font-mono text-slate-900">${totColl.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans font-bold">Efectivo</span>
                            <span>${cashColl.toLocaleString('es-AR')}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans font-bold">Mercado Pago</span>
                            <span>${mpColl.toLocaleString('es-AR')}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans font-bold">Transferencia</span>
                            <span>${trColl.toLocaleString('es-AR')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Arqueo físico de Efectivo */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] font-sans text-slate-400 uppercase font-extrabold block">
                            Efectivo Esperado
                          </span>
                          <span className="font-bold text-slate-900">
                            ${c.expectedCash.toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-sans text-slate-400 uppercase font-extrabold block">
                            Efectivo Contado
                          </span>
                          <span className="font-bold text-slate-900">
                            ${c.countedCash.toLocaleString('es-AR')}
                          </span>
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

          {/* EGRESOS / MOVIMIENTOS DE CAJA GENERAL */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    Egresos / Movimientos de Caja General
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pagos a proveedores, gastos desde fondos generales y movimientos de cuentas
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full self-start sm:self-auto">
                {filteredGeneralMovements.length} movimientos
              </span>
            </div>

            {/* Barra de Filtros */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Buscador */}
              <div className="relative min-w-[200px] flex-1">
                <input
                  type="text"
                  placeholder="Buscar concepto o proveedor..."
                  value={genSearch}
                  onChange={(e) => setGenSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {genSearch && (
                  <button
                    onClick={() => setGenSearch('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filtro Período */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setGenPeriodFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    genPeriodFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setGenPeriodFilter('today')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    genPeriodFilter === 'today' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setGenPeriodFilter('month')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    genPeriodFilter === 'month' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Este Mes
                </button>
              </div>

              {/* Filtro Fondo Origen */}
              <select
                value={genFundFilter}
                onChange={(e) => setGenFundFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Fondo Origen: Todos</option>
                <option value="caja_general">Solo Efectivo General</option>
                <option value="mercado_pago">Solo Mercado Pago</option>
                <option value="transfer">Solo Transferencias / Banco</option>
              </select>

              {/* Filtro Tipo */}
              <select
                value={genTypeFilter}
                onChange={(e) => setGenTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tipo: Todos</option>
                <option value="SUPPLIER_PAYMENT">Pagos a Proveedores</option>
                <option value="EXPENSE">Gastos Operativos</option>
                <option value="INTERNAL_TRANSFER">Pases Internos / Retiros</option>
                <option value="MANUAL">Movimientos Manuales</option>
              </select>
            </div>

            {/* Listado de Egresos de Caja General */}
            {filteredGeneralMovements.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Wallet className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Sin movimientos para los filtros seleccionados</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  No se encontraron egresos ni movimientos de Caja General en este período.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGeneralMovements.map((mov) => {
                  const isIncome = mov.type === 'INCOME';

                  return (
                    <div
                      key={mov.id}
                      onClick={() => {
                        if (mov.sourceType === 'SUPPLIER_PAYMENT') {
                          setSelectedMovementForDetail(mov);
                        } else if (mov.sourceType === 'EXPENSE') {
                          setLinkedExpenseId(mov.sourceId);
                        } else {
                          setSelectedMovementForDetail(mov);
                        }
                      }}
                      className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white hover:border-indigo-300 hover:shadow-xs transition-all shadow-2xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-white font-black shadow-xs ${
                            isIncome ? 'bg-emerald-600' : 'bg-rose-500'
                          }`}
                        >
                          {isIncome ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition-colors">
                              {mov.description}
                            </span>
                            {renderSourceBadge(mov.sourceType)}
                            {renderFundBadge(mov)}
                            {renderMethodBadge(mov.paymentMethod)}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono flex-wrap">
                            <span>{formatLocalDateTime(mov.createdAt || mov.date)}</span>
                            {mov.providerName && (
                              <span className="text-slate-600 font-sans font-medium">
                                • Proveedor: <strong>{mov.providerName}</strong>
                              </span>
                            )}
                            {mov.notes && (
                              <span className="text-slate-500 font-sans italic truncate max-w-xs">
                                • {mov.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0">
                        <p className={`text-base font-black font-mono ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {isIncome ? '+' : '-'}${mov.amount.toLocaleString('es-AR')}
                        </p>
                        <span className="text-[10px] text-slate-400 font-bold group-hover:text-indigo-600 flex items-center gap-0.5 transition-colors">
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

      {/* ========================================================================= */}
      {/* VISTA 3: GASTOS (EMBEDDED)                                                 */}
      {/* ========================================================================= */}
      {activeMainTab === 'expenses' && (
        <div className="animate-fadeIn">
          <ExpensesPage isEmbedded={true} onBackToHome={() => setActiveMainTab('caja_diaria')} />
        </div>
      )}

      {/* Modal: Registrar Gasto Rápido */}
      {showQuickExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[88dvh]">
            <div className="p-4 bg-rose-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">Registrar Gasto</h3>
              </div>
              <button
                onClick={() => setShowQuickExpenseModal(false)}
                disabled={isSubmittingQuickExp}
                className="p-1.5 text-rose-200 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickExpense} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Concepto / Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Concepto / Descripción <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Pan, bolsas, combustible, flete, etc."
                  value={quickExpDesc}
                  onChange={(e) => setQuickExpDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
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
                    value={quickExpAmountStr}
                    onChangeRaw={(e) => setQuickExpAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>

              {/* Origen del dinero / Fondo pagado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  ¿Desde qué fondo se paga? <span className="text-rose-500">*</span>
                </label>
                <select
                  value={quickExpPaidFrom}
                  onChange={(e) => setQuickExpPaidFrom(e.target.value as ExpensePaidFrom)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  <option value="caja_diaria">Caja Diaria (Cajón físico del local)</option>
                  <option value="caja_general">Caja General (Recaudación acumulada / Caja fuerte)</option>
                  <option value="mercado_pago">Mercado Pago (Cuenta digital)</option>
                  <option value="transfer">Transferencia / Banco</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {quickExpPaidFrom === 'caja_diaria'
                    ? '⚠️ Se descontará del Efectivo Esperado en el cajón de hoy.'
                    : '✅ Se paga con fondos generales o cuentas digitales. NO descuenta del cajón físico.'}
                </p>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Categoría
                </label>
                <select
                  value={quickExpCategory}
                  onChange={(e) => setQuickExpCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales o comprobante..."
                  value={quickExpNotes}
                  onChange={(e) => setQuickExpNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQuickExpenseModal(false)}
                  disabled={isSubmittingQuickExp}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickExp}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmittingQuickExp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Registrar Gasto</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
