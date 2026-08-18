import React, { useRef } from 'react';

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string;
  onChangeValue?: (val: number) => void;
  onChangeRaw?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  allowDecimal?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChangeValue,
  onChangeRaw,
  allowDecimal = true,
  onFocus,
  onClick,
  onTouchEnd,
  className = '',
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const selectContent = () => {
    if (inputRef.current) {
      try {
        inputRef.current.select();
      } catch {}
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    selectContent();
    // Microtask timeouts for mobile & web browser auto-select retention
    setTimeout(selectContent, 20);
    setTimeout(selectContent, 100);
    if (onFocus) onFocus(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    selectContent();
    if (onClick) onClick(e);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    setTimeout(selectContent, 50);
    if (onTouchEnd) onTouchEnd(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawVal = e.target.value;

    // Fix concatenation issue when typing after '0':
    // If string starts with leading 0 followed immediately by digits (e.g. "01500" -> "1500")
    if (/^0+[1-9]/.test(rawVal)) {
      rawVal = rawVal.replace(/^0+/, '');
      e.target.value = rawVal;
    } else if (/^0+0+$/.test(rawVal)) {
      // If user types "00", keep as single "0"
      rawVal = '0';
      e.target.value = rawVal;
    }

    if (onChangeRaw) onChangeRaw(e);

    if (onChangeValue) {
      if (rawVal === '' || rawVal === undefined) {
        onChangeValue(0);
      } else {
        const parsed = allowDecimal ? parseFloat(rawVal) : parseInt(rawVal, 10);
        onChangeValue(isNaN(parsed) ? 0 : parsed);
      }
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={value}
      onFocus={handleFocus}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
};
