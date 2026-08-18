import React, { useState, useRef, useEffect } from 'react';
import { Scan } from 'lucide-react';

export interface BarcodeInputProps {
  value?: string;
  onChange?: (val: string) => void;
  onBarcodeDetected: (barcode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement> | React.MutableRefObject<HTMLInputElement | null>;
  className?: string;
  showIndicator?: boolean;
  clearOnSubmit?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const BarcodeInput: React.FC<BarcodeInputProps> = ({
  value: externalValue,
  onChange,
  onBarcodeDetected,
  placeholder = 'Escanear código de barras o escribir...',
  disabled = false,
  autoFocus = true,
  inputRef: externalRef,
  className = '',
  showIndicator = true,
  clearOnSubmit = true,
  onKeyDown,
}) => {
  const [internalValue, setInternalValue] = useState('');
  const internalRef = useRef<HTMLInputElement>(null);
  const activeRef = externalRef || internalRef;

  const isControlled = externalValue !== undefined;
  const currentValue = isControlled ? externalValue : internalValue;

  useEffect(() => {
    if (autoFocus && activeRef.current) {
      activeRef.current.focus();
    }
  }, [autoFocus, activeRef]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isControlled) {
      setInternalValue(val);
    }
    if (onChange) {
      onChange(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = currentValue.trim();
      if (trimmed) {
        onBarcodeDetected(trimmed);
        if (clearOnSubmit) {
          if (!isControlled) {
            setInternalValue('');
          }
          if (onChange) {
            onChange('');
          }
        }
      }
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
          <Scan className="w-5 h-5 stroke-[2.2]" />
        </div>

        <input
          ref={activeRef as any}
          type="text"
          value={currentValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`w-full pl-11 ${showIndicator ? 'pr-32' : 'pr-4'} py-3 bg-white border-2 border-slate-200 focus:border-emerald-600 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-all disabled:bg-slate-100 ${className}`}
        />

        {showIndicator && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-[10px] font-extrabold text-emerald-700 pointer-events-none select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Lector USB listo</span>
          </div>
        )}
      </div>
    </div>
  );
};
