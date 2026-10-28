import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Loc, LOCS, otherLoc, Pay } from '../core/model';
import { money } from '../core/calc';
import { changeRecordLocation, UserError } from '../data/ops';

/* ---------------- Íconos (SVG propios, sin dependencias) ---------------- */
const PATHS: Record<string, string> = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  venta: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
  clientes: 'M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 20c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2M16 4.6a3.2 3.2 0 0 1 0 6.2M18 14.9c1.7.7 2.8 2.4 3 5.1',
  stock: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
  compras: 'M4 4h16v4H4zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M12 11v6M9 14h6',
  proveedores: 'M3 17V7h11v10M14 10h4l3 3v4h-7M7 19.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM17 19.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  caja: 'M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18M16 15h2',
  reportes: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8',
};
export const Icon: React.FC<{ name: string; size?: number }> = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[name] || ''} />
  </svg>
);

/* ---------------- Avisos ---------------- */
type ToastKind = '' | 'err' | 'warn';
interface ToastItem { id: number; msg: string; kind: ToastKind; action?: { label: string; fn: () => void } }
const ToastCtx = createContext<(msg: string, kind?: ToastKind, action?: ToastItem['action']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const push = useCallback((msg: string, kind: ToastKind = '', action?: ToastItem['action']) => {
    const id = idRef.current++;
    setItems((p) => [...p.slice(-3), { id, msg, kind, action }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), kind === 'err' ? 7000 : 4800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="ds-toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={'ds-toast ' + t.kind}>
            <span>{t.msg}</span>
            {t.action && <button onClick={() => { t.action!.fn(); setItems((p) => p.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

/** Ejecuta una operación y muestra el error en un aviso claro. */
export function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: (r: T) => string | void): Promise<T | undefined> => {
    setBusy(true);
    try {
      const r = await fn();
      const m = ok ? ok(r) : undefined;
      if (m) toast(m);
      return r;
    } catch (e: any) {
      if (!(e instanceof UserError)) console.error(e);
      const msg = e instanceof UserError ? e.message
        : e?.code === 'permission-denied' ? 'La base de datos rechazó la operación (permisos). No se guardó.'
        : 'No se pudo guardar: ' + (e?.message || 'error desconocido') + '. Probá de nuevo.';
      toast(msg, 'err');
      return undefined;
    } finally { setBusy(false); }
  }, [toast]);
  return { run, busy };
}

/* ---------------- Modal ---------------- */
const modalStack: object[] = [];
export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, footer, wide }) => {
  useEffect(() => {
    // Con ventanas una sobre otra, Escape cierra solo la de arriba.
    const token = {};
    modalStack.push(token);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && modalStack[modalStack.length - 1] === token) onClose(); };
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); const i = modalStack.indexOf(token); if (i >= 0) modalStack.splice(i, 1); };
  }, [onClose]);
  return (
    <div className="ds-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'ds-modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="ds-modal-h"><h2>{title}</h2><button className="ds-btn ghost sm" onClick={onClose} aria-label="Cerrar">✕</button></div>
        <div className="ds-modal-b">{children}</div>
        {footer && <div className="ds-modal-f">{footer}</div>}
      </div>
    </div>
  );
};

/* ---------------- Piezas chicas ---------------- */
export const LocDot: React.FC<{ loc: Loc }> = ({ loc }) => <span className={'ds-dot d-' + loc} />;
export const LocName: React.FC<{ loc: Loc }> = ({ loc }) => <b><LocDot loc={loc} />{LOCS[loc]}</b>;

export const Kpi: React.FC<{ label: React.ReactNode; value: string; sub?: React.ReactNode; children?: React.ReactNode; big?: boolean }> = ({ label, value, sub, children, big }) => (
  <div className="ds-panel ds-kpi">
    <span className="ds-label">{label}</span>
    <span className="v num" style={big ? { fontSize: '2.1rem' } : undefined}>{value}</span>
    {sub && <span className="s">{sub}</span>}
    {children}
  </div>
);

export const PayPills: React.FC<{ pay: Pay }> = ({ pay }) => (
  <span className="ds-row" style={{ gap: 4 }}>
    {pay.cash > 0 && <span className="ds-pill p-ok num">Efectivo {money(pay.cash)}</span>}
    {pay.mp > 0 && <span className="ds-pill p-mp num">MP {money(pay.mp)}</span>}
    {pay.transfer > 0 && <span className="ds-pill p-neu num">Transf. {money(pay.transfer)}</span>}
    {pay.credit > 0 && <span className="ds-pill p-fi num">Fiado {money(pay.credit)}</span>}
  </span>
);

/** Campo de importe: acepta "1500", "1.500" o "1.500,50". */
export const AmountInput: React.FC<{ id: string; value: string; onChange: (v: string) => void; placeholder?: string; big?: boolean; autoFocus?: boolean; className?: string; ariaLabel?: string; onEnter?: () => void }> = (p) => (
  <input id={p.id} type="text" inputMode="decimal" autoComplete="off" className={'num ' + (p.big ? 'big ' : '') + (p.className || '')}
    value={p.value} placeholder={p.placeholder} autoFocus={p.autoFocus} aria-label={p.ariaLabel}
    onChange={(e) => p.onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && p.onEnter) { e.preventDefault(); p.onEnter(); } }} />
);

export async function copyText(text: string, toast: (m: string, k?: any) => void) {
  try { await navigator.clipboard.writeText(text); toast('Copiado. Pegalo en WhatsApp.'); }
  catch { window.prompt('Copiá este texto:', text); }
}

/** Botón en dos pasos para pasar un gasto o un cobro a la otra sucursal. */
export const MoveLocButton: React.FC<{ col: 'expenses' | 'account_movements'; id: string; loc: Loc }> = ({ col, id, loc }) => {
  const { run, busy } = useRun();
  const [ask, setAsk] = useState(false);
  const to = otherLoc(loc);
  if (!ask) return <button className="ds-btn ghost sm" onClick={(e) => { e.stopPropagation(); setAsk(true); }}>Pasar a {LOCS[to]}</button>;
  return (
    <span className="ds-row" style={{ gap: 4, display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <button className="ds-btn sm pri" disabled={busy} onClick={() => run(() => changeRecordLocation(col, id, to), () => 'Pasado a ' + LOCS[to] + '.').then(() => setAsk(false))}>Confirmar</button>
      <button className="ds-btn ghost sm" onClick={() => setAsk(false)}>No</button>
    </span>
  );
};
