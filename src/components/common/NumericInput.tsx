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
    // Microtask timeout to beat mobile browsers' auto-deselect after focus
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

    // Automatically strip leading zeros if followed by digits (e.g., "025" -> "25")
    if (/^0[0-9]+/.test(rawVal)) {
      rawVal = rawVal.replace(/^0+/, '');
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
