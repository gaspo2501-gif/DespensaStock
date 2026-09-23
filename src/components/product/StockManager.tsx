import React, { useState, useEffect } from 'react';
import { Product, StockOperation, getStockForLocation } from '../../types/product';
import { productService } from '../../services/firebase/productService';
import { NumericInput } from '../common/NumericInput';
import { Plus, Minus, Equal, CheckCircle2, AlertCircle, Save, Layers, Building2 } from 'lucide-react';
import { playScanSound } from '../../utils/audio';
import { useLocation } from '../../context/LocationContext';
import { getLocationName } from '../../types/location';

interface StockManagerProps {
  product: Product;
  onStockUpdated: (updatedProduct: Product) => void;
  onScanNext?: () => void;
  className?: string;
  initialOperation?: StockOperation;
}

export const StockManager: React.FC<StockManagerProps> = ({
  product,
  onStockUpdated,
  onScanNext,
  className = '',
  initialOperation = 'add',
}) => {
  const { activeLocation } = useLocation();
  const [operation, setOperation] = useState<StockOperation>(initialOperation);

  useEffect(() => {
    if (initialOperation) {
      setOperation(initialOperation);
    }
  }, [initialOperation, product.id]);
  const [amountInput, setAmountInput] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentStock = getStockForLocation(product, activeLocation);
  const numAmount = parseInt(amountInput, 10);
  const validAmount = isNaN(numAmount) || numAmount < 0 ? 0 : numAmount;

  // Calculate projected new stock
  let projectedStock = currentStock;
  if (operation === 'add') {
    projectedStock = currentStock + validAmount;
  } else if (operation === 'subtract') {
    projectedStock = currentStock - validAmount;
  } else if (operation === 'set') {
    projectedStock = validAmount;
  }

  const isNegative = operation === 'subtract' && validAmount > currentStock;

  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
  }, [product.id, operation, amountInput]);

  const handleQuickAddPreset = (value: number) => {
    if (operation === 'set') {
      setAmountInput(value.toString());
    } else {
      setAmountInput((prev) => {
        const current = parseInt(prev, 10);
        const base = isNaN(current) ? 0 : current;
        return Math.max(1, base + value).toString();
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (isNaN(numAmount) || numAmount < 0) {
      setError('Por favor ingresa un número válido mayor o igual a 0');
      return;
    }

    if (operation === 'subtract' && numAmount > currentStock) {
      setError(`No se puede restar ${numAmount} unidades porque el stock actual es de ${currentStock}.`);
      return;
    }

    setLoading(true);

    try {
      const updated = await productService.updateStock(product.id, operation, numAmount, activeLocation);
      onStockUpdated(updated);
      playScanSound('success');
      const locStock = getStockForLocation(updated, activeLocation);
      setSuccessMessage(`¡Stock en ${getLocationName(activeLocation)} actualizado a ${locStock} unidades!`);
      // Reset input for potential next action
      setAmountInput('1');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el stock');
      playScanSound('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-5 bg-white border border-slate-200 rounded-3xl shadow-md space-y-4 ${className}`}>
      {/* Header: Current Stock Display */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-600" />
              {getLocationName(activeLocation)}
            </span>
            <h3 className="text-xs font-semibold text-slate-700">Inventario local</h3>
          </div>
        </div>

        <div className="text-right">
          <span className="text-2xl font-black text-slate-900 font-mono">{currentStock}</span>
          <span className="text-xs font-bold text-slate-500 ml-1">unid.</span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          {onScanNext && (
            <button
              onClick={onScanNext}
              className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-[11px] font-extrabold hover:bg-emerald-700 transition-colors"
            >
              Siguiente →
            </button>
          )}
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-shake">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Operation Selection (3 Tabs: + Sumar, - Restar, = Establecer) */}
      <div>
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Operación a realizar
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setOperation('add')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              operation === 'add'
                ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600 ring-offset-1'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Sumar
          </button>

          <button
            type="button"
            onClick={() => setOperation('subtract')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              operation === 'subtract'
                ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-600 ring-offset-1'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Minus className="w-4 h-4 stroke-[2.5]" />
            Restar
          </button>

          <button
            type="button"
            onClick={() => setOperation('set')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              operation === 'set'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-1'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Equal className="w-4 h-4 stroke-[2.5]" />
            Establecer
          </button>
        </div>
      </div>

      {/* Amount Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {operation === 'add' && 'Cantidad a agregar'}
            {operation === 'subtract' && 'Cantidad a restar'}
            {operation === 'set' && 'Nueva cantidad total física'}
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const cur = parseInt(amountInput, 10) || 0;
                if (cur > 1) setAmountInput((cur - 1).toString());
              }}
              className="w-12 h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-2xl font-bold text-lg flex items-center justify-center transition-colors flex-shrink-0"
            >
              -
            </button>

            <NumericInput
              min="0"
              allowDecimal={false}
              value={amountInput}
              onChangeRaw={(e) => setAmountInput(e.target.value)}
              className={`flex-1 h-12 px-4 bg-slate-50 border rounded-2xl text-center text-xl font-mono font-bold focus:bg-white focus:outline-none transition-colors ${
                isNegative ? 'border-rose-400 text-rose-600' : 'border-slate-300 text-slate-900 focus:border-emerald-500'
              }`}
            />

            <button
              type="button"
              onClick={() => {
                const cur = parseInt(amountInput, 10) || 0;
                setAmountInput((cur + 1).toString());
              }}
              className="w-12 h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-2xl font-bold text-lg flex items-center justify-center transition-colors flex-shrink-0"
            >
              +
            </button>
          </div>
        </div>

        {/* Quick Presets Buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Rápido:</span>
          {[1, 5, 10, 24].map((preset) => (
            <button
              type="button"
              key={preset}
              onClick={() => handleQuickAddPreset(preset)}
              className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              +{preset}
            </button>
          ))}
        </div>

        {/* Calculation Preview */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Resultado final:</span>
          <div className="font-mono font-extrabold text-sm">
            {operation === 'add' && (
              <span>{currentStock} + {validAmount} = <strong className="text-emerald-700">{projectedStock}</strong></span>
            )}
            {operation === 'subtract' && (
              <span>
                {currentStock} - {validAmount} ={' '}
                <strong className={isNegative ? 'text-rose-600 font-black' : 'text-amber-700'}>
                  {isNegative ? 'INVÁLIDO (<0)' : projectedStock}
                </strong>
              </span>
            )}
            {operation === 'set' && (
              <span>{currentStock} → <strong className="text-blue-700">{validAmount}</strong></span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading || isNegative || isNaN(numAmount)}
          className={`w-full py-3.5 rounded-2xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
            isNegative
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'
          }`}
        >
          <Save className="w-4 h-4" />
          {loading ? 'Guardando Stock...' : 'Confirmar y Guardar Stock'}
        </button>
      </form>
    </div>
  );
};
