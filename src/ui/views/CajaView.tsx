import React, { useMemo, useState } from 'react';
import { Closure, Fund, FUND_LABEL, Loc, LOCS, LOC_IDS, PAY_FUNDS } from '../../core/model';
import { dayCash, fdate, fdateL, generalCash, money, parseAmount, today } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { adjustGeneralBalance, cancelManualMovement, cancelClosure, cancelExpense, closeCash, createExpense, setExpenseFund, setRecordLocation, UserError } from '../../data/ops';
import { AmountInput, Kpi, LocName, Modal, MoveLocButton, useRun } from '../common';
import { SaleDetailModal } from '../SaleDetail';
import type { ShellApi } from '../Shell';

const EXP_CATS = ['Alquiler', 'Electricidad', 'Agua', 'Internet', 'Teléfono', 'Impuestos', 'Transporte', 'Mantenimiento', 'Comisiones', 'Publicidad', 'Limpieza', 'Sueldos', 'Otros'];
type Tab = 'hoy' | 'general' | 'gastos';

export const CajaView: React.FC<{ api: ShellApi }> = ({ api }) => {
  const { data } = useData();
  const [tab, setTab] = useState<Tab>('hoy');
  const [modal, setModal] = useState<null | 'close' | 'expense' | { sale: string } | { closure: string }>(null);
  const loc = api.loc;
  const allRecords = useMemo(() => [
    ...data.expenses.filter((e) => e.rawLocation === 'all').map((e) => ({ col: 'expenses' as const, id: e.id, label: 'Gasto: ' + e.description, date: e.date, amount: e.amount })),
    ...data.cashMovs.filter((m) => m.rawLocation === 'all').map((m) => ({ col: 'cash_movements' as const, id: m.id, label: m.description, date: m.date, amount: m.amount })),
    ...data.closures.filter((c) => c.rawLocation === 'all').map((c) => ({ col: 'cash_closures' as const, id: c.id, label: 'Cierre de caja', date: c.date, amount: c.countedCash })),
  ], [data]);

  return (
    <>
      <div className="ds-row spread">
        <div><h1>Caja</h1><div className="muted">{tab === 'general' ? 'Tu plata acumulada, las dos sucursales' : <>Sucursal <LocName loc={loc} /> · {fdateL(today())}</>}</div></div>
        <div className="ds-row"><button className="ds-btn" onClick={() => setModal('expense')}>Registrar gasto</button>{tab === 'hoy' && <button className="ds-btn pri" onClick={() => setModal('close')}>Cerrar caja</button>}</div>
      </div>
      {allRecords.length > 0 && <FixLocations records={allRecords} />}
      <div className="ds-tabs">{([['hoy', 'Caja del día'], ['general', 'Caja general'], ['gastos', 'Gastos']] as [Tab, string][]).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'hoy' && <CajaHoy loc={loc} onSale={(id) => setModal({ sale: id })} onClosure={(id) => setModal({ closure: id })} />}
      {tab === 'general' && <CajaGeneral loc={loc} />}
      {tab === 'gastos' && <Gastos />}
      {modal === 'close' && <CloseModal loc={loc} onClose={() => setModal(null)} />}
      {modal === 'expense' && <ExpenseModal loc={loc} onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && 'sale' in modal && <SaleDetailModal saleId={modal.sale} onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && 'closure' in modal && <ClosureModal id={modal.closure} onClose={() => setModal(null)} />}
    </>
  );
};

interface Op { t: string; kind: string; det: string; cash: number; mp: number; fi: number; cancel?: boolean; sale?: string; closure?: string; sort: string }

const CajaHoy: React.FC<{ loc: Loc; onSale: (id: string) => void; onClosure: (id: string) => void }> = ({ loc, onSale, onClosure }) => {
  const { data } = useData();
  const T = today();
  const d = useMemo(() => dayCash(data, loc, T), [data, loc, T]);
  const custName = useMemo(() => new Map(data.customers.map((c) => [c.id, c.name])), [data.customers]);
  const ops = useMemo(() => {
    const o: Op[] = [];
    for (const s of data.sales) if (s.loc === loc && s.date === T) o.push({ t: s.time, sort: s.createdAt, kind: 'Venta', det: s.items.map((i) => i.qty + '× ' + i.name).join(', ') + (s.customerName && s.pay.credit ? ' · ' + s.customerName : ''), cash: s.pay.cash, mp: s.pay.mp + s.pay.transfer, fi: s.pay.credit, cancel: s.status === 'CANCELLED', sale: s.id });
    for (const a of data.acc) if (a.type === 'PAYMENT' && a.loc === loc && a.date === T) o.push({ t: a.time, sort: a.createdAt, kind: 'Cobro de fiado', det: custName.get(a.customerId) || 'Cliente', cash: a.pay.cash, mp: a.pay.mp + a.pay.transfer, fi: -a.amount, cancel: a.status === 'CANCELLED' });
    for (const e of data.expenses) if (e.loc === loc && e.date === T && e.fund === 'caja_diaria') o.push({ t: '', sort: e.createdAt, kind: 'Gasto', det: e.category + ': ' + e.description, cash: -e.amount, mp: 0, fi: 0, cancel: e.status === 'CANCELLED' });
    for (const p of data.spays) if (p.loc === loc && p.date === T && p.fund === 'caja_diaria') o.push({ t: '', sort: p.createdAt, kind: 'Pago a proveedor', det: p.providerName, cash: -p.amount, mp: 0, fi: 0, cancel: p.status === 'CANCELLED' });
    for (const m of data.cashMovs) if (m.loc === loc && m.date === T) {
      if (m.sourceType === 'INTERNAL_TRANSFER') { if (!m.closureId) o.push({ t: m.time, sort: m.createdAt, kind: 'Pase a caja general', det: m.description, cash: -m.amount, mp: 0, fi: 0, cancel: m.status === 'CANCELLED' }); }
      else if (m.fund === 'caja_diaria') { const v = m.type === 'INCOME' ? m.amount : -m.amount; o.push({ t: m.time, sort: m.createdAt, kind: 'Movimiento manual', det: m.description, cash: v, mp: 0, fi: 0, cancel: m.status === 'CANCELLED' }); }
    }
    for (const c of data.closures) if (c.loc === loc && c.date === T && (c.autoTransferId || c.expectedMp !== undefined)) o.push({ t: c.time, sort: c.createdAt, kind: 'Cierre de caja', det: 'Pasaron ' + money(c.countedCash) + ' a caja general', cash: -c.expectedCash, mp: -(c.expectedMp || 0), fi: 0, cancel: c.status === 'CANCELLED', closure: c.id });
    return o.sort((a, b) => (b.sort || '').localeCompare(a.sort || ''));
  }, [data, loc, T, custName]);
  const closuresToday = data.closures.filter((c) => c.loc === loc && c.date === T);
  const past = data.closures.filter((c) => c.loc === loc && c.date < T && c.status !== 'CANCELLED').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const sign = (v: number) => (Math.abs(v) >= 0.5 ? <span className={'num ' + (v < 0 ? 'down' : '')}>{v > 0 ? '+' : ''}{money(v)}</span> : <span className="muted">—</span>);

  return (
    <>
      <div className="ds-grid g3">
        <Kpi label={<><span className="ds-dot" style={{ background: 'var(--cash)' }} />Efectivo</>} value={money(d.cashIn - d.cashOut)} sub={'Entró ' + money(d.cashIn) + ' · salió ' + money(d.cashOut)}>
          <div className="ds-note" style={{ marginTop: 6 }}>En el cajón tendría que haber <b className="num" style={{ color: 'var(--ink)' }}>{money(d.drawer)}</b>{d.closedCash ? ' (después del cierre)' : ''}</div>
        </Kpi>
        <Kpi label={<><span className="ds-dot" style={{ background: 'var(--mp)' }} />Mercado Pago</>} value={money(d.mpIn)} sub={'Entró hoy' + (d.transferIn ? ' · transferencias ' + money(d.transferIn) : '') + '. Lo que pagás con Mercado Pago sale del Mercado Pago general.'} />
        <Kpi label={<><span className="ds-dot" style={{ background: 'var(--fiado)' }} />Fiado</>} value={money(d.credit)} sub={'Fiado hoy · cobraste ' + money(d.collectedDebt) + ' de fiados'} />
      </div>
      <div className="ds-panel">
        <div className="ds-panel-h"><h2>Operaciones de hoy</h2><span className="muted small">{d.salesCount} ventas · vendido {money(d.sold)}</span></div>
        {ops.length ? (
          <div className="ds-tbl"><table>
            <thead><tr><th>Hora</th><th>Operación</th><th className="hide-m">Detalle</th><th className="r">Efectivo</th><th className="r">MP</th><th className="r">Fiado</th></tr></thead>
            <tbody>{ops.map((o, i) => (
              <tr key={i} className={(o.sale || o.closure ? 'click ' : '') + (o.cancel ? 'cancel' : '')} onClick={() => { if (o.sale) onSale(o.sale); else if (o.closure) onClosure(o.closure); }}>
                <td className="num">{o.t}</td>
                <td><b>{o.kind}</b><div className="small muted trunc show-m" style={{ maxWidth: 220 }}>{o.det}</div></td>
                <td className="hide-m small muted" style={{ maxWidth: 360 }}>{o.det}</td>
                <td className="r">{sign(o.cash)}</td><td className="r">{sign(o.mp)}</td><td className="r">{sign(o.fi)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="ds-empty">Todavía no hubo operaciones hoy.</div>}
      </div>
      {closuresToday.length > 0 && <div className="ds-panel"><h2 style={{ marginBottom: 8 }}>Cierres de hoy</h2>{closuresToday.map((c) => <ClosureRow key={c.id} c={c} onClick={() => onClosure(c.id)} />)}</div>}
      {past.length > 0 && <div className="ds-panel"><h2 style={{ marginBottom: 8 }}>Últimos cierres en {LOCS[loc]}</h2>{past.map((c) => <ClosureRow key={c.id} c={c} onClick={() => onClosure(c.id)} />)}</div>}
    </>
  );
};

const DiffPill: React.FC<{ v: number }> = ({ v }) => (Math.abs(v) < 1 ? <span className="ds-pill p-ok">Exacto</span> : <span className={'ds-pill num ' + (v < 0 ? 'p-bad' : 'p-warn')}>{v < 0 ? 'Faltaron ' : 'Sobraron '}{money(Math.abs(v))}</span>);
const ClosureRow: React.FC<{ c: Closure; onClick: () => void }> = ({ c, onClick }) => (
  <div className={'ds-li click ' + (c.status === 'CANCELLED' ? 'cancel' : '')} onClick={onClick}>
    <div className="grow"><b>{fdate(c.date)}{c.time ? ' · ' + c.time : ''}</b><div className="small muted">Efectivo contado {money(c.countedCash)}{c.autoTransferId ? ' → caja general' : ''}{c.notes ? ' · ' + c.notes : ''}</div></div>
    <span className="small muted">Efectivo</span><DiffPill v={c.countedCash - c.expectedCash} />
    {c.expectedMp !== undefined && <><span className="small muted hide-m">MP</span><span className="hide-m"><DiffPill v={(c.countedMp || 0) - c.expectedMp} /></span></>}
  </div>
);

const ClosureModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [reason, setReason] = useState('');
  const c = data.closures.find((x) => x.id === id);
  if (!c) return null;
  return (
    <Modal title={'Cierre del ' + fdate(c.date) + (c.time ? ' · ' + c.time : '')} onClose={onClose}>
      <div className="ds-cmp">
        <span>Efectivo esperado</span><b className="num">{money(c.expectedCash)}</b>
        <span>Efectivo contado</span><b className="num">{money(c.countedCash)}</b>
        {c.expectedMp !== undefined && <><span>Entradas de MP según la app</span><b className="num">{money(c.expectedMp)}</b><span>Entradas de MP verificadas</span><b className="num">{money(c.countedMp || 0)}</b></>}
      </div>
      {c.notes && <div className="ds-note">{c.notes}</div>}
      {c.status === 'CANCELLED' ? <span className="ds-pill p-neu">Anulado</span> : (
        <details>
          <summary>Anular este cierre</summary>
          <div className="ds-col" style={{ marginTop: 8 }}>
            <label className="ds-field"><span>Motivo</span><input id="cc-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: conté mal" /></label>
            <div className="small muted">{c.autoTransferId ? 'También se anula el pase a caja general de ' + money(c.countedCash) + '. ' : ''}Después podés volver a cerrar la caja.</div>
            <button className="ds-btn danger" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => run(() => cancelClosure(c.id, c.autoTransferId, reason), () => 'Cierre anulado.').then((r) => { if (r) onClose(); })}>Anular cierre</button>
          </div>
        </details>
      )}
    </Modal>
  );
};

const CloseModal: React.FC<{ loc: Loc; onClose: () => void }> = ({ loc, onClose }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const d = useMemo(() => dayCash(data, loc, today()), [data, loc]);
  const [cash, setCash] = useState('');
  const [mp, setMp] = useState(String(Math.round(d.mpPending * 100) / 100));
  const [notes, setNotes] = useState('');
  const diff = (v: string, exp: number) => {
    if (v === '') return null;
    const x = parseAmount(v) - exp;
    return Math.abs(x) < 1 ? <span className="ds-pill p-ok">Cuadra</span> : <span className={'ds-pill num ' + (x < 0 ? 'p-bad' : 'p-warn')}>{x < 0 ? 'Faltan ' : 'Sobran '}{money(Math.abs(x))}</span>;
  };
  const save = () => {
    if (cash === '') return run(async () => { throw new UserError('Ingresá el efectivo que contaste.'); });
    const counted = parseAmount(cash);
    run(() => closeCash({ loc, expectedCash: d.drawer, countedCash: counted, expectedMp: d.mpPending, countedMp: parseAmount(mp), cashIn: d.cashIn, mpIn: d.mpIn, transferIn: d.transferIn, notes }),
      (r) => 'Caja cerrada. ' + money(counted) + ' pasaron a caja general' + (Math.abs(counted - d.drawer) >= 1 ? ' · ' + (counted < d.drawer ? 'faltaron ' : 'sobraron ') + money(Math.abs(counted - d.drawer)) + ' (anotado)' : '') + '.' + (r === 'queued' ? ' Guardado en este equipo.' : ''))
      .then((r) => { if (r) onClose(); });
  };
  return (
    <Modal title={'Cerrar caja · ' + LOCS[loc]} onClose={onClose} wide
      footer={<><button className="ds-btn" onClick={onClose}>Cancelar</button><button className="ds-btn pri" disabled={busy} onClick={save}>Cerrar caja</button></>}>
      <div className="ds-grid g2">
        <div className="ds-panel">
          <h3>Efectivo</h3>
          <div className="ds-cmp" style={{ margin: '8px 0' }}><span>La app dice</span><b className="num">{money(d.drawer)}</b></div>
          <label className="ds-field"><span>Contaste</span><AmountInput id="cl-cash" big autoFocus value={cash} onChange={setCash} /></label>
          <div style={{ marginTop: 6 }}>{diff(cash, d.drawer)}</div>
        </div>
        <div className="ds-panel">
          <h3>Mercado Pago</h3>
          <div className="ds-cmp" style={{ margin: '8px 0' }}><span>Entró hoy según la app</span><b className="num">{money(d.mpPending)}</b></div>
          <label className="ds-field"><span>Entró según la app de Mercado Pago</span><AmountInput id="cl-mp" big value={mp} onChange={setMp} /></label>
          <div style={{ marginTop: 6 }}>{diff(mp, d.mpPending)}</div>
        </div>
      </div>
      <label className="ds-field"><span>Nota (opcional)</span><input id="cl-note" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: faltan $500, revisar ticket de las 18 h" /></label>
      <div className="ds-note">Podés cerrar aunque no cuadre: la diferencia queda anotada. Al cerrar, el efectivo que contaste pasa solo a la caja general.</div>
    </Modal>
  );
};

const CajaGeneral: React.FC<{ loc: Loc }> = ({ loc }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [adjust, setAdjust] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);
  const g = useMemo(() => generalCash(data), [data]);
  const mv = useMemo(() => {
    const out: { sort: string; date: string; det: string; cash: number; mp: number; id?: string; adj?: boolean }[] = [];
    for (const m of data.cashMovs) {
      if (m.status === 'CANCELLED') continue;
      if (m.sourceType === 'INTERNAL_TRANSFER') out.push({ sort: m.createdAt || m.date, date: m.date, det: (m.closureId ? 'Cierre de caja ' : 'Pase a caja general ') + LOCS[m.loc], cash: m.amount, mp: 0 });
      else if (m.fund === 'caja_general' || m.fund === 'mercado_pago' || m.fund === 'transfer') { const v = m.type === 'INCOME' ? m.amount : -m.amount; out.push({ sort: m.createdAt || m.date, date: m.date, det: m.description + (m.adjustment && m.notes ? ' · ' + m.notes : ''), cash: m.fund === 'caja_general' ? v : 0, mp: m.fund !== 'caja_general' ? v : 0, id: m.id, adj: m.adjustment }); }
    }
    for (const e of data.expenses) if (e.status !== 'CANCELLED' && (e.fund === 'caja_general' || e.fund === 'mercado_pago')) out.push({ sort: e.createdAt || e.date, date: e.date, det: 'Gasto: ' + e.description + ' (' + LOCS[e.loc] + ')', cash: e.fund === 'caja_general' ? -e.amount : 0, mp: e.fund === 'mercado_pago' ? -e.amount : 0 });
    for (const p of data.spays) if (p.status !== 'CANCELLED' && (p.fund === 'caja_general' || p.fund === 'mercado_pago')) out.push({ sort: p.createdAt || p.date, date: p.date, det: 'Pago a ' + p.providerName, cash: p.fund === 'caja_general' ? -p.amount : 0, mp: p.fund === 'mercado_pago' ? -p.amount : 0 });
    const mpDay = new Map<string, number>();
    for (const s of data.sales) if (s.status !== 'CANCELLED' && s.pay.mp) mpDay.set(s.date, (mpDay.get(s.date) || 0) + s.pay.mp);
    for (const a of data.acc) if (a.status !== 'CANCELLED' && a.type === 'PAYMENT' && a.pay.mp) mpDay.set(a.date, (mpDay.get(a.date) || 0) + a.pay.mp);
    for (const [date, v] of mpDay) out.push({ sort: date + 'T23:59', date, det: 'Entradas de Mercado Pago del día', cash: 0, mp: v });
    return out.sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 60);
  }, [data]);
  const sign = (v: number) => (Math.abs(v) >= 0.5 ? <span className={'num ' + (v < 0 ? 'down' : '')}>{v > 0 ? '+' : ''}{money(v)}</span> : <span className="muted">—</span>);
  return (
    <>
      <div className="ds-panel">
        <div className="ds-grid g3" style={{ alignItems: 'end' }}>
          <div className="ds-kpi"><span className="ds-label">Tu plata total</span><span className="v num" style={{ fontSize: '2.2rem' }}>{money(g.total)}</span><span className="s">Efectivo + Mercado Pago{g.transfer ? ' + transferencias' : ''}</span></div>
          <div className="ds-kpi"><span className="ds-label"><span className="ds-dot" style={{ background: 'var(--cash)' }} />Efectivo</span><span className="v num">{money(g.cash)}</span><span className="s">Lo que pasó por los cierres y pases, menos lo que pagaste con esta plata</span></div>
          <div className="ds-kpi"><span className="ds-label"><span className="ds-dot" style={{ background: 'var(--mp)' }} />Mercado Pago general</span><span className="v num">{money(g.mp)}</span><span className="s">Todo lo que entró por MP, menos lo que pagaste con MP{g.transfer ? '. Más ' + money(g.transfer) + ' en transferencias' : ''}</span></div>
        </div>
        {Math.abs(g.openDrawers) >= 1 && <div className="ds-note" style={{ marginTop: 12 }}>Además hay <b className="num">{money(g.openDrawers)}</b> en efectivo en los cajones de hoy que todavía no se cerraron.</div>}
        <div className="ds-row" style={{ marginTop: 12 }}><button className="ds-btn" onClick={() => setAdjust(true)}>Ajustar saldo</button><span className="small muted">Para llevar el efectivo y Mercado Pago a lo que tenés de verdad.</span></div>
      </div>
      <div className="ds-panel">
        <h2 style={{ marginBottom: 8 }}>Movimientos</h2>
        <div className="ds-tbl"><table><thead><tr><th>Fecha</th><th>Detalle</th><th className="r">Efectivo</th><th className="r">MP</th><th /></tr></thead>
          <tbody>{mv.map((m, i) => (
            <tr key={i}>
              <td className="num">{fdate(m.date)}</td><td>{m.adj ? <b>{m.det}</b> : m.det}</td><td className="r">{sign(m.cash)}</td><td className="r">{sign(m.mp)}</td>
              <td className="r" style={{ whiteSpace: 'nowrap' }}>{m.id && (ask === m.id
                ? <><button className="ds-btn sm danger" disabled={busy} onClick={() => run(() => cancelManualMovement(m.id!), () => 'Movimiento anulado.').then(() => setAsk(null))}>Confirmar</button> <button className="ds-btn ghost sm" onClick={() => setAsk(null)}>No</button></>
                : <button className="ds-btn ghost sm" onClick={() => setAsk(m.id!)}>Anular</button>)}</td>
            </tr>))}</tbody></table></div>
        <div className="small muted" style={{ marginTop: 8 }}>Se muestran los últimos 60.</div>
      </div>
      {adjust && <AdjustModal loc={loc} appCash={g.cash} appMp={g.mp + g.transfer} transfer={g.transfer} onClose={() => setAdjust(false)} />}
    </>
  );
};

const AdjustModal: React.FC<{ loc: Loc; appCash: number; appMp: number; transfer: number; onClose: () => void }> = ({ loc, appCash, appMp, transfer, onClose }) => {
  const { run, busy } = useRun();
  const [cash, setCash] = useState(String(Math.round(appCash * 100) / 100));
  const [mp, setMp] = useState(String(Math.round(appMp * 100) / 100));
  const [note, setNote] = useState('');
  const dc = parseAmount(cash) - appCash, dm = parseAmount(mp) - appMp;
  const d = (v: number) => (Math.abs(v) < 0.01 ? <span className="ds-pill p-ok">Sin cambios</span> : <span className={'ds-pill num ' + (v < 0 ? 'p-bad' : 'p-warn')}>{v > 0 ? 'Se suman ' : 'Se restan '}{money(Math.abs(v))}</span>);
  return (
    <Modal title="Ajustar saldo de caja general" onClose={onClose} wide
      footer={<><button className="ds-btn" onClick={onClose}>Cancelar</button><button className="ds-btn pri" disabled={busy}
        onClick={() => run(() => adjustGeneralBalance({ realCash: parseAmount(cash), appCash, realMp: parseAmount(mp), appMp, note, loc }), () => 'Saldo ajustado. Si te equivocaste, anulalo desde Movimientos.').then((r) => { if (r) onClose(); })}>Guardar ajuste</button></>}>
      <div className="ds-grid g2">
        <div className="ds-panel">
          <h3>Efectivo de caja general</h3>
          <div className="ds-cmp" style={{ margin: '8px 0' }}><span>La app dice</span><b className="num">{money(appCash)}</b></div>
          <label className="ds-field"><span>Tenés de verdad</span><AmountInput id="adj-cash" big autoFocus value={cash} onChange={setCash} /></label>
          <div style={{ marginTop: 6 }}>{d(dc)}</div>
          <div className="small muted" style={{ marginTop: 6 }}>Solo la plata guardada. No cuentes lo de los cajones de hoy: eso entra cuando cerrás la caja.</div>
        </div>
        <div className="ds-panel">
          <h3>Mercado Pago general</h3>
          <div className="ds-cmp" style={{ margin: '8px 0' }}><span>La app dice</span><b className="num">{money(appMp)}</b></div>
          <label className="ds-field"><span>Saldo real en tu cuenta de Mercado Pago</span><AmountInput id="adj-mp" big value={mp} onChange={setMp} /></label>
          <div style={{ marginTop: 6 }}>{d(dm)}</div>
          {transfer !== 0 && <div className="small muted" style={{ marginTop: 6 }}>Incluye {money(transfer)} de transferencias, que entran a la misma cuenta.</div>}
        </div>
      </div>
      <label className="ds-field"><span>Nota (opcional)</span><input id="adj-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: saldo inicial real" /></label>
      <div className="ds-note">La diferencia se guarda como un movimiento “Ajuste de saldo”. No cuenta como venta ni como gasto, así que los reportes no cambian. Mirá el saldo de Mercado Pago justo antes de guardar, por si entró una venta nueva.</div>
    </Modal>
  );
};

const Gastos: React.FC = () => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [fix, setFix] = useState<string | null>(null);
  const list = [...data.expenses].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 150);
  const unknown = data.expenses.filter((e) => !e.fundExplicit && e.status !== 'CANCELLED').length;
  return (
    <div className="ds-panel">
      {unknown > 0 && <div className="ds-note" style={{ marginBottom: 10 }}>{unknown} gastos viejos no tienen guardado de dónde salió la plata. La app supone el fondo que se indica; si no es correcto, tocá “Corregir”.</div>}
      {list.length ? (
        <div className="ds-tbl"><table>
          <thead><tr><th>Fecha</th><th>Gasto</th><th className="hide-m">Sucursal</th><th>Salió de</th><th className="r">Importe</th><th /></tr></thead>
          <tbody>{list.map((e) => (
            <tr key={e.id} className={e.status === 'CANCELLED' ? 'cancel' : ''}>
              <td className="num">{fdate(e.date)}</td>
              <td><b>{e.category}</b><div className="small muted">{e.description}</div></td>
              <td className="hide-m">{LOCS[e.loc]}</td>
              <td>
                {fix === e.id ? (
                  <div className="ds-chips">{PAY_FUNDS.map((f) => <button key={f} className="ds-chip" disabled={busy} onClick={() => run(() => setExpenseFund(e.id, f), () => 'Origen corregido.').then(() => setFix(null))}>{FUND_LABEL[f]}</button>)}</div>
                ) : (
                  <span className={'ds-pill ' + (e.fund === 'mercado_pago' ? 'p-mp' : e.fund === 'caja_diaria' ? 'p-ok' : 'p-neu')}>{FUND_LABEL[e.fund]}{!e.fundExplicit ? ' (supuesto)' : ''}</span>
                )}
              </td>
              <td className="r num">{money(e.amount)}</td>
              <td className="r" style={{ whiteSpace: 'nowrap' }}>
                {e.status !== 'CANCELLED' && !e.fundExplicit && fix !== e.id && <button className="ds-btn ghost sm" onClick={() => setFix(e.id)}>Corregir</button>}
                {e.status !== 'CANCELLED' && <MoveLocButton col="expenses" id={e.id} loc={e.loc} />}
                {e.status !== 'CANCELLED' && <button className="ds-btn ghost sm" disabled={busy} onClick={() => run(() => cancelExpense(e.id, 'Anulado desde Caja'), () => 'Gasto anulado. La plata vuelve a ' + FUND_LABEL[e.fund] + '.')}>Anular</button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="ds-empty">Todavía no hay gastos registrados.</div>}
    </div>
  );
};

const ExpenseModal: React.FC<{ loc: Loc; onClose: () => void }> = ({ loc, onClose }) => {
  const { run, busy } = useRun();
  const [cat, setCat] = useState('Otros');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [fund, setFund] = useState<Fund | ''>('');
  return (
    <Modal title={'Registrar gasto · ' + LOCS[loc]} onClose={onClose}
      footer={<><button className="ds-btn" onClick={onClose}>Cancelar</button><button className="ds-btn pri" disabled={busy}
        onClick={() => run(() => createExpense({ category: cat, description: desc, amount: parseAmount(amount), fund: fund as Fund, loc }), (r) => 'Gasto de ' + money(parseAmount(amount)) + ' registrado desde ' + FUND_LABEL[fund as Fund] + '.' + (r === 'queued' ? ' Guardado en este equipo.' : '')).then((r) => { if (r) onClose(); })}>Guardar gasto</button></>}>
      <div className="ds-grid g2">
        <label className="ds-field"><span>Categoría</span><select id="ex-cat" value={cat} onChange={(e) => setCat(e.target.value)}>{EXP_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="ds-field"><span>Importe</span><AmountInput id="ex-amt" autoFocus value={amount} onChange={setAmount} /></label>
      </div>
      <label className="ds-field"><span>Detalle</span><input id="ex-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: factura de luz de septiembre" /></label>
      <div className="ds-field"><span>¿De dónde salió la plata? (obligatorio)</span><div className="ds-chips">{PAY_FUNDS.map((k) => <button key={k} className={'ds-chip ' + (fund === k ? 'on' : '')} onClick={() => setFund(k)}>{FUND_LABEL[k]}</button>)}</div></div>
    </Modal>
  );
};

const FixLocations: React.FC<{ records: { col: 'expenses' | 'cash_movements' | 'cash_closures'; id: string; label: string; date: string; amount: number }[] }> = ({ records }) => {
  const { run, busy } = useRun();
  return (
    <div className="ds-panel" style={{ borderColor: 'var(--warn)' }}>
      <b>Registros sin sucursal</b>
      <div className="small muted" style={{ margin: '4px 0 8px' }}>La versión anterior guardó estos registros con la sucursal “Todas”, así que no aparecen en ninguna caja. Indicá a qué sucursal pertenece cada uno.</div>
      <div className="ds-list">{records.map((r) => (
        <div className="ds-li" key={r.col + r.id}>
          <div className="grow"><b>{fdate(r.date)}</b> · {r.label} · <span className="num">{money(r.amount)}</span></div>
          {LOC_IDS.map((l) => <button key={l} className="ds-btn sm" disabled={busy} onClick={() => run(() => setRecordLocation(r.col, r.id, l), () => 'Registro asignado a ' + LOCS[l] + '.')}>{LOCS[l]}</button>)}
        </div>
      ))}</div>
    </div>
  );
};
