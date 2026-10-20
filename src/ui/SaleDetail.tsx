import React, { useMemo, useState } from 'react';
import { LOCS, Sale } from '../core/model';
import { balances, fdate, money, parseAmount, payFromParts, payTotal } from '../core/calc';
import { useData } from '../data/DataContext';
import { cancelSale, changeSalePayment } from '../data/ops';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { AmountInput, Modal, PayPills, useRun } from './common';

export const SaleDetailModal: React.FC<{ saleId: string; onClose: () => void }> = ({ saleId, onClose }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [reason, setReason] = useState('');
  const s = data.sales.find((x) => x.id === saleId);
  if (!s) return <Modal title="Venta" onClose={onClose}><div className="ds-empty">La venta todavía se está guardando.</div></Modal>;
  const cancelled = s.status === 'CANCELLED';
  return (
    <Modal title={'Venta del ' + fdate(s.date) + (s.time ? ' · ' + s.time : '')} onClose={onClose} wide>
      <div className="ds-row" style={{ gap: 6 }}>
        <span className={'ds-pill p-' + s.loc}>{LOCS[s.loc]}</span>
        {cancelled && <span className="ds-pill p-neu">Anulada{s.cancellationReason ? ': ' + s.cancellationReason : ''}</span>}
      </div>
      <div className="ds-tbl">
        <table>
          <thead><tr><th>Producto</th><th className="r">Cant.</th><th className="r">Precio</th><th className="r">Subtotal</th></tr></thead>
          <tbody>
            {s.items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="r num">{i.qty}</td><td className="r num">{money(i.unitPrice)}</td><td className="r num">{money(i.subtotal)}</td></tr>)}
            <tr><td colSpan={3}><b>Total</b></td><td className="r num"><b>{money(s.total)}</b></td></tr>
          </tbody>
        </table>
      </div>
      <PayPills pay={s.pay} />
      {s.customerName && s.pay.credit > 0 && <div className="small">Fiado a nombre de <b>{s.customerName}</b></div>}
      {s.paymentChanges && s.paymentChanges.length > 0 && <div className="small muted">Forma de pago corregida: {s.paymentChanges.map((c) => fdate(c.at.slice(0, 10)) + (c.reason ? ' (' + c.reason + ')' : '')).join(' · ')}</div>}
      {!cancelled && <ChangePayment sale={s} />}
      {!cancelled && (
        <details>
          <summary>Anular esta venta</summary>
          <div className="ds-col" style={{ marginTop: 8 }}>
            <label className="ds-field"><span>Motivo</span><input id="cs-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: se cobró dos veces" /></label>
            <div className="small muted">Se devuelve el stock a {LOCS[s.loc]}{s.pay.credit > 0 ? ' y se descuenta el fiado del cliente' : ''}. La plata sale de la caja del día.</div>
            <button className="ds-btn danger" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => run(() => cancelSale(s.id, reason), () => 'Venta anulada. Se devolvió el stock.').then((r) => { if (r !== undefined) onClose(); })}>Anular venta</button>
          </div>
        </details>
      )}
    </Modal>
  );
};

type Mode = 'cash' | 'mp' | 'credit' | 'mixed' | 'transfer';
const MODE_LABEL: Record<Mode, string> = { cash: 'Efectivo', mp: 'Mercado Pago', credit: 'Fiado', mixed: 'Combinado', transfer: 'Transferencia' };

/** Corregir la forma de pago de una venta sin anularla. */
const ChangePayment: React.FC<{ sale: Sale }> = ({ sale }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(sale.pay.mp === sale.total ? 'cash' : 'mp');
  const [split, setSplit] = useState({ mp: '', cash: '', credit: '', transfer: '' });
  const [customerId, setCustomerId] = useState<string | null>(sale.customerId || null);
  const [custQ, setCustQ] = useState('');
  const [reason, setReason] = useState('');
  const bal = useMemo(() => balances(data), [data]);
  const total = sale.total;
  const pay = useMemo(() => {
    if (mode === 'mixed') return payFromParts({ mp: parseAmount(split.mp), cash: parseAmount(split.cash), credit: parseAmount(split.credit), transfer: parseAmount(split.transfer) });
    return payFromParts({ [mode === 'mp' ? 'mp' : mode]: total } as any);
  }, [mode, split, total]);
  const customer = customerId ? data.customers.find((c) => c.id === customerId) : undefined;
  const closed = data.closures.some((c) => c.loc === sale.loc && c.date === sale.date && c.status !== 'CANCELLED');
  const custList = data.customers.filter((c) => !custQ.trim() || c.name.toLowerCase().includes(custQ.trim().toLowerCase())).slice(0, 20);
  const same = pay.cash === sale.pay.cash && pay.mp === sale.pay.mp && pay.transfer === sale.pay.transfer && pay.credit === sale.pay.credit && (pay.credit === 0 || customerId === (sale.customerId || null));
  const fill = (k: keyof typeof split) => {
    const others = (['mp', 'cash', 'credit', 'transfer'] as const).filter((x) => x !== k).reduce((t, x) => t + parseAmount(split[x]), 0);
    setSplit((p) => ({ ...p, [k]: String(Math.max(0, Math.round((total - others) * 100) / 100) || '') }));
  };
  const save = () => run(
    () => changeSalePayment({ saleId: sale.id, pay, customer: pay.credit > 0 ? customer : undefined, reason, customerBalance: sale.customerId ? bal[sale.customerId] || 0 : undefined }),
    () => 'Forma de pago corregida. Las cajas ya se actualizaron.',
  ).then((r) => { if (r) setOpen(false); });

  if (!open) return <button className="ds-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Cambiar forma de pago</button>;
  return (
    <div className="ds-panel soft ds-col">
      <div className="ds-row spread"><b>Cambiar forma de pago</b><button className="ds-btn ghost sm" onClick={() => setOpen(false)}>Cancelar</button></div>
      <div className="small muted">Hoy está registrada como: <PayPills pay={sale.pay} /></div>
      <div className="ds-chips">{(['cash', 'mp', 'credit', 'mixed', 'transfer'] as Mode[]).map((m) => <button key={m} className={'ds-chip ' + (mode === m ? 'on' : '')} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>)}</div>
      {mode === 'mixed' && (
        <>
          <div className="ds-split">
            {([['mp', 'Mercado Pago'], ['cash', 'Efectivo'], ['credit', 'Fiado'], ['transfer', 'Transferencia']] as [keyof typeof split, string][]).map(([k, l]) => (
              <React.Fragment key={k}><label htmlFor={'cp-' + k}>{l}</label><AmountInput id={'cp-' + k} value={split[k]} onChange={(v) => setSplit((p) => ({ ...p, [k]: v }))} placeholder="0" /><button className="ds-btn sm" onClick={() => fill(k)}>Resto</button></React.Fragment>
            ))}
          </div>
          <div className="ds-cmp"><span>Asignado</span><b className="num">{money(payTotal(pay))}</b><span>{total - payTotal(pay) >= 0 ? 'Falta asignar' : 'Te pasaste por'}</span><b className={'num ' + (Math.abs(total - payTotal(pay)) < 1 ? 'diff0' : 'diffx')}>{money(Math.abs(total - payTotal(pay)))}</b></div>
        </>
      )}
      {pay.credit > 0 && (customer ? (
        <div className="ds-chosen"><span>Fiado a nombre de {customer.name}</span><button className="ds-btn ghost sm" onClick={() => setCustomerId(null)}>Cambiar</button></div>
      ) : (
        <div>
          <label className="ds-field"><span>Cliente para el fiado (obligatorio)</span><input id="cp-cust" type="search" autoComplete="off" placeholder="Escribí el nombre" value={custQ} onChange={(e) => setCustQ(e.target.value)} /></label>
          <div className="ds-cust-pick" style={{ marginTop: 6 }}>{custList.map((c) => <button key={c.id} onClick={() => setCustomerId(c.id)}><span>{c.name}</span><span className="small muted num">{(bal[c.id] || 0) > 0.5 ? 'Debe ' + money(bal[c.id]) : 'Sin deuda'}</span></button>)}</div>
        </div>
      ))}
      <label className="ds-field"><span>Motivo (opcional)</span><input id="cp-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: se marcó efectivo y pagó con Mercado Pago" /></label>
      <div className="small">Va a quedar: <PayPills pay={pay} /></div>
      <div className="small muted">No cambia el stock. La caja del {fdate(sale.date)} en {LOCS[sale.loc]} y la caja general se recalculan solas{sale.pay.credit > 0 || pay.credit > 0 ? ', y se ajusta la deuda del cliente' : ''}.</div>
      {closed && <div className="ds-note" style={{ color: 'var(--warn)', background: 'var(--warn-soft)' }}>La caja de ese día ya está cerrada. El cierre guardado no se modifica: la corrección va a aparecer como diferencia en esa caja.</div>}
      <button className="ds-btn pri" style={{ alignSelf: 'flex-start' }} disabled={busy || same || Math.abs(payTotal(pay) - total) >= 1 || (pay.credit > 0 && !customer)} onClick={save}>Guardar nueva forma de pago</button>
    </div>
  );
};

export const ScannerModal: React.FC<{ onClose: () => void; onCode: (c: string) => void }> = ({ onClose, onCode }) => (
  <Modal title="Escanear con la cámara" onClose={onClose}>
    <BarcodeScanner isScanningActive={true} onScanSuccess={(c) => { onClose(); onCode(c); }} />
  </Modal>
);
