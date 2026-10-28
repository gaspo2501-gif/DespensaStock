import React, { useMemo, useState } from 'react';
import { AccMov, LOCS, Sale } from '../../core/model';
import { balances, fdate, money, parseAmount } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { registerCustomerPayment } from '../../data/ops';
import { AmountInput, copyText, Modal, MoveLocButton, PayPills, useRun, useToast } from '../common';
import { NewCustomerModal } from './VentaView';
import type { ShellApi } from '../Shell';
import { SaleDetailModal } from '../SaleDetail';

/**
 * Cuánto queda pendiente de cada fiado: los pagos se aplican a los fiados más viejos primero.
 */
function pendingByDebt(movs: AccMov[]): Map<string, number> {
  const act = movs.filter((a) => a.status !== 'CANCELLED');
  let paid = act.filter((a) => a.type === 'PAYMENT').reduce((t, a) => t + a.amount, 0);
  const debts = act.filter((a) => a.type === 'DEBT').sort((x, y) => (x.createdAt || x.date).localeCompare(y.createdAt || y.date));
  const out = new Map<string, number>();
  for (const d of debts) { const used = Math.min(paid, d.amount); paid -= used; out.set(d.id, Math.round((d.amount - used) * 100) / 100); }
  return out;
}
const itemsText = (s?: Sale) => (s ? s.items.map((i) => i.qty + '× ' + i.name).join(', ') : '');

export const ClientesView: React.FC<{ api: ShellApi }> = ({ api }) => {
  const { data } = useData();
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<string | null>(null);
  const [collect, setCollect] = useState<string | null>(null);
  const [newCust, setNewCust] = useState(false);
  const bal = useMemo(() => balances(data), [data]);
  const lastMov = useMemo(() => {
    const m = new Map<string, { date: string; type: string }>();
    for (const a of data.acc) { if (a.status === 'CANCELLED') continue; const x = m.get(a.customerId); if (!x || a.createdAt > x.date) m.set(a.customerId, { date: a.createdAt || a.date, type: a.type }); }
    return m;
  }, [data.acc]);
  const total = Object.values(bal).reduce((t, v) => t + Math.max(0, v), 0);
  const list = data.customers
    .filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || c.phone.includes(q.trim()))
    .sort((a, b) => (bal[b.id] || 0) - (bal[a.id] || 0) || a.name.localeCompare(b.name, 'es'));

  return (
    <>
      <div className="ds-row spread">
        <div><h1>Clientes y fiado</h1><div className="muted">Por cobrar en total: <b className="num" style={{ color: 'var(--fiado)' }}>{money(total)}</b></div></div>
        <button className="ds-btn pri" onClick={() => setNewCust(true)}>Nuevo cliente</button>
      </div>
      <div className="ds-panel">
        <input id="cli-q" type="search" placeholder="Buscar cliente por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360, marginBottom: 10 }} />
        {list.length ? (
          <div className="ds-tbl"><table>
            <thead><tr><th>Cliente</th><th className="hide-m">Teléfono</th><th className="hide-m">Último movimiento</th><th className="r">Saldo</th><th /></tr></thead>
            <tbody>{list.map((c) => {
              const b = bal[c.id] || 0; const lm = lastMov.get(c.id);
              return (
                <tr key={c.id} className="click" onClick={() => setDetail(c.id)}>
                  <td><b>{c.name}</b></td>
                  <td className="hide-m num muted">{c.phone || '—'}</td>
                  <td className="hide-m muted">{lm ? fdate(lm.date.slice(0, 10)) + ' · ' + (lm.type === 'DEBT' ? 'Fiado' : 'Pago') : '—'}</td>
                  <td className="r num" style={b > 0.5 ? { color: 'var(--fiado)', fontWeight: 700 } : undefined}>{b > 0.5 ? money(b) : 'Sin deuda'}</td>
                  <td className="r">{b > 0.5 && <button className="ds-btn sm" onClick={(e) => { e.stopPropagation(); setCollect(c.id); }}>Cobrar</button>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="ds-empty">No hay clientes con ese nombre.</div>}
      </div>
      {newCust && <NewCustomerModal onClose={() => setNewCust(false)} />}
      {detail && <CustomerDetail id={detail} onClose={() => setDetail(null)} onCollect={() => { setCollect(detail); setDetail(null); }} />}
      {collect && <CollectModal id={collect} loc={api.loc} onClose={() => setCollect(null)} />}
    </>
  );
};

const CustomerDetail: React.FC<{ id: string; onClose: () => void; onCollect: () => void }> = ({ id, onClose, onCollect }) => {
  const { data } = useData();
  const toast = useToast();
  const [saleId, setSaleId] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const c = data.customers.find((x) => x.id === id);
  const b = balances(data)[id] || 0;
  const salesById = useMemo(() => new Map(data.sales.map((s) => [s.id, s])), [data.sales]);
  const movs = useMemo(() => data.acc.filter((a) => a.customerId === id).sort((x, y) => (y.createdAt || y.date).localeCompare(x.createdAt || x.date)), [data.acc, id]);
  const pending = useMemo(() => pendingByDebt(movs), [movs]);
  if (!c) return null;
  const pendingDebts = movs.filter((a) => a.type === 'DEBT' && a.status !== 'CANCELLED' && (pending.get(a.id) || 0) > 0.5).reverse();
  const detailLines = pendingDebts.map((a) => {
    const s = a.saleId ? salesById.get(a.saleId) : undefined;
    const p = pending.get(a.id) || 0;
    return '• ' + fdate(a.date) + ': ' + (itemsText(s) || a.description || 'Fiado') + ' — ' + money(p) + (p < a.amount - 0.5 ? ' (de ' + money(a.amount) + ')' : '');
  });
  const msg = `Hola ${c.name.split(' ')[0]}, te recuerdo que tenés un saldo pendiente de ${money(b)} en la despensa.` + (detailLines.length ? `\n\nDetalle:\n${detailLines.join('\n')}` : '') + `\n\n¡Gracias!`;
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  return (
    <Modal title={c.name} onClose={onClose} wide>
      <div className="ds-row spread">
        <div className="ds-kpi"><span className="ds-label">Debe</span><span className="v num" style={{ color: 'var(--fiado)' }}>{money(b)}</span></div>
        {b > 0.5 && <div className="ds-row"><button className="ds-btn pri" onClick={onCollect}>Cobrar</button><button className="ds-btn" onClick={() => copyText(msg, toast)}>Copiar recordatorio con el detalle</button></div>}
      </div>
      {c.phone && <div className="small muted">Teléfono: <span className="num" style={{ userSelect: 'all' }}>{c.phone}</span></div>}
      <div className="small muted">Tocá un fiado para ver qué llevó. Los pagos se descuentan de los fiados más viejos primero.</div>
      <div className="ds-tbl"><table>
        <thead><tr><th>Fecha</th><th>Movimiento</th><th>Sucursal</th><th className="r">Importe</th><th>Estado</th></tr></thead>
        <tbody>{movs.map((a) => {
          const s = a.type === 'DEBT' && a.saleId ? salesById.get(a.saleId) : undefined;
          const p = pending.get(a.id) || 0;
          const isOpen = open.has(a.id);
          const cancelled = a.status === 'CANCELLED';
          return (
            <React.Fragment key={a.id}>
              <tr className={(a.type === 'DEBT' ? 'click ' : '') + (cancelled ? 'cancel' : '')} onClick={() => a.type === 'DEBT' && toggle(a.id)}>
                <td className="num">{fdate(a.date)}{s?.time ? <div className="small muted">{s.time}</div> : null}</td>
                <td>
                  {a.type === 'DEBT' ? <><span className="ds-pill p-fi">Fiado</span> <span className="small muted">{isOpen ? '▾' : '▸'} {s ? s.items.length + (s.items.length === 1 ? ' producto' : ' productos') : (a.description || 'sin detalle')}</span></>
                    : <><span className="ds-pill p-ok">Pago</span> <PayPills pay={a.pay} /></>}
                  {a.type === 'DEBT' && !isOpen && s && <div className="small muted trunc" style={{ maxWidth: 360 }}>{itemsText(s)}</div>}
                </td>
                <td className="muted">{LOCS[a.loc]}{a.type === 'PAYMENT' && !cancelled && <> <MoveLocButton col="account_movements" id={a.id} loc={a.loc} /></>}</td>
                <td className="r num">{a.type === 'DEBT' ? '+' : '−'}{money(a.amount)}</td>
                <td>{a.type === 'DEBT' && !cancelled && (p < 0.5 ? <span className="ds-pill p-ok">Pagado</span> : p < a.amount - 0.5 ? <span className="ds-pill p-warn num">Debe {money(p)}</span> : <span className="ds-pill p-fi">Pendiente</span>)}</td>
              </tr>
              {isOpen && (
                <tr><td colSpan={5} style={{ background: 'var(--surface-2)' }}>
                  {s ? (
                    <div className="ds-col" style={{ gap: 6 }}>
                      <table style={{ width: '100%' }}><tbody>
                        {s.items.map((i, k) => <tr key={k}><td style={{ border: 0, padding: '2px 0' }}>{i.qty}× {i.name}</td><td className="r num" style={{ border: 0, padding: '2px 0' }}>{money(i.unitPrice)} c/u</td><td className="r num" style={{ border: 0, padding: '2px 0' }}><b>{money(i.subtotal)}</b></td></tr>)}
                      </tbody></table>
                      <div className="small muted">{s.pay.credit < s.total - 0.5 ? 'Venta de ' + money(s.total) + ': fiado ' + money(s.pay.credit) + ', el resto se pagó en el momento. ' : ''}{s.status === 'CANCELLED' ? 'La venta fue anulada. ' : ''}</div>
                      <button className="ds-btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setSaleId(s.id)}>Ver la venta completa</button>
                    </div>
                  ) : <div className="small muted">{a.description || 'Fiado'}: este fiado no está asociado a una venta, así que no tiene detalle de productos.</div>}
                </td></tr>
              )}
            </React.Fragment>
          );
        })}</tbody>
      </table></div>
      {saleId && <SaleDetailModal saleId={saleId} onClose={() => setSaleId(null)} />}
    </Modal>
  );
};

const CollectModal: React.FC<{ id: string; loc: 'aimogasta' | 'olascoaga'; onClose: () => void }> = ({ id, loc, onClose }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const c = data.customers.find((x) => x.id === id)!;
  const b = balances(data)[id] || 0;
  const [amount, setAmount] = useState(String(Math.round(b * 100) / 100));
  const [mode, setMode] = useState<'cash' | 'mp' | 'mixed'>('cash');
  const [cash, setCash] = useState('');
  const [mp, setMp] = useState('');
  const a = parseAmount(amount);
  const parts = mode === 'mixed' ? parseAmount(cash) + parseAmount(mp) : a;
  const save = () => run(
    () => registerCustomerPayment({ customerId: id, amount: a, cash: mode === 'cash' ? a : mode === 'mixed' ? parseAmount(cash) : 0, mp: mode === 'mp' ? a : mode === 'mixed' ? parseAmount(mp) : 0, balance: b, loc }),
    (r) => `Cobro registrado: ${money(a)}. Le queda ${money(Math.max(0, b - a))}.` + (r === 'queued' ? ' (guardado en este equipo)' : ''),
  ).then((r) => { if (r) onClose(); });
  return (
    <Modal title={'Cobrar a ' + c.name} onClose={onClose}
      footer={<><button className="ds-btn" onClick={onClose}>Cancelar</button><button className="ds-btn pri" disabled={busy} onClick={save}>Registrar cobro</button></>}>
      <label className="ds-field"><span>Importe que paga</span><AmountInput id="col-amt" big autoFocus value={amount} onChange={setAmount} /></label>
      <div className="ds-chips"><button className="ds-chip" onClick={() => setAmount(String(Math.round(b * 100) / 100))}>Saldar todo ({money(b)})</button></div>
      <div>
        <div className="ds-label" style={{ marginBottom: 6 }}>¿Cómo paga?</div>
        <div className="ds-chips">{([['cash', 'Efectivo'], ['mp', 'Mercado Pago'], ['mixed', 'Efectivo + MP']] as const).map(([m, l]) => <button key={m} className={'ds-chip ' + (mode === m ? 'on' : '')} onClick={() => setMode(m)}>{l}</button>)}</div>
      </div>
      {mode === 'mixed' && (
        <div className="ds-split">
          <label htmlFor="col-cash">Efectivo</label><AmountInput id="col-cash" value={cash} onChange={setCash} /><span />
          <label htmlFor="col-mp">Mercado Pago</label><AmountInput id="col-mp" value={mp} onChange={setMp} /><span />
        </div>
      )}
      <div className="ds-note">
        <div className="ds-cmp">
          <span>Debía</span><b className="num">{money(b)}</b>
          <span>Paga</span><b className="num">{money(a)}</b>
          <span>Le queda</span><b className="num" style={{ color: 'var(--fiado)' }}>{money(Math.max(0, b - a))}</b>
          {mode === 'mixed' && <><span>Efectivo + MP</span><b className={'num ' + (Math.abs(parts - a) < 1 ? 'diff0' : 'diffx')}>{money(parts)}</b></>}
        </div>
        {a > b + 0.5 && <div style={{ color: 'var(--danger)', marginTop: 6 }}>El pago no puede superar lo que debe.</div>}
        <div className="small" style={{ marginTop: 6 }}>Se registra en {LOCS[loc]}.</div>
      </div>
    </Modal>
  );
};
