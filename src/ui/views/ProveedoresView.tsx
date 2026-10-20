import React, { useMemo, useState } from 'react';
import { Fund, FUND_LABEL, LOCS, PAY_FUNDS } from '../../core/model';
import { fdate, money, parseAmount, providerAccount, purchaseState } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { createProvider, payProvider } from '../../data/ops';
import { AmountInput, Modal, useRun } from '../common';
import type { ShellApi } from '../Shell';

export const ProveedoresView: React.FC<{ api: ShellApi }> = ({ api }) => {
  const { data } = useData();
  const [pay, setPay] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const rows = useMemo(() => data.providers.map((v) => {
    const a = providerAccount(data, v.id);
    const last = [...a.purchases].sort((x, y) => y.date.localeCompare(x.date))[0];
    return { v, ...a, last };
  }).sort((x, y) => y.debt - x.debt || x.v.name.localeCompare(y.v.name, 'es')), [data]);
  const totalDebt = rows.reduce((t, r) => t + r.debt, 0);
  return (
    <>
      <div className="ds-row spread">
        <div><h1>Proveedores</h1><div className="muted">Les debés en total: <b className="num" style={{ color: 'var(--danger)' }}>{money(totalDebt)}</b></div></div>
        <button className="ds-btn" onClick={() => setCreate(true)}>Nuevo proveedor</button>
      </div>
      <div className="ds-panel">
        {rows.length ? (
          <div className="ds-tbl"><table>
            <thead><tr><th>Proveedor</th><th className="hide-m">Última compra</th><th className="r hide-m">Comprado</th><th className="r hide-m">Pagado</th><th className="r">Le debés</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.v.id} className="click" onClick={() => setDetail(r.v.id)}>
                <td><b>{r.v.name}</b></td><td className="hide-m">{r.last ? fdate(r.last.date) : '—'}</td>
                <td className="r num hide-m">{money(r.bought)}</td><td className="r num hide-m">{money(r.paid)}</td>
                <td className="r num" style={r.debt > 0.5 ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{r.debt > 0.5 ? money(r.debt) : 'Al día'}</td>
                <td className="r">{r.debt > 0.5 && <button className="ds-btn sm" onClick={(e) => { e.stopPropagation(); setPay(r.v.id); }}>Pagar</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="ds-empty">Todavía no cargaste proveedores.</div>}
      </div>
      {pay && <PayModal id={pay} loc={api.loc} onClose={() => setPay(null)} />}
      {detail && <ProviderDetail id={detail} onClose={() => setDetail(null)} onPay={() => { setPay(detail); setDetail(null); }} />}
      {create && <NewProvider onClose={() => setCreate(false)} />}
    </>
  );
};

const ProviderDetail: React.FC<{ id: string; onClose: () => void; onPay: () => void }> = ({ id, onClose, onPay }) => {
  const { data } = useData();
  const v = data.providers.find((x) => x.id === id)!;
  const a = providerAccount(data, id);
  const mov = [
    ...a.purchases.map((p) => ({ d: p.createdAt || p.date, date: p.date, t: 'Ingreso de mercadería', amt: p.total, st: purchaseState(p) })),
    ...a.pays.map((p) => ({ d: p.createdAt || p.date, date: p.date, t: 'Pago desde ' + FUND_LABEL[p.fund], amt: -p.amount, st: '' })),
  ].sort((x, y) => y.d.localeCompare(x.d)).slice(0, 50);
  return (
    <Modal title={v.name} onClose={onClose} wide>
      <div className="ds-row spread">
        <div className="ds-grid g3" style={{ flex: 1 }}>
          <div className="ds-kpi"><span className="ds-label">Comprado</span><span className="v num">{money(a.bought)}</span></div>
          <div className="ds-kpi"><span className="ds-label">Pagado</span><span className="v num">{money(a.paid)}</span></div>
          <div className="ds-kpi"><span className="ds-label">Le debés</span><span className="v num" style={{ color: a.debt > 0.5 ? 'var(--danger)' : undefined }}>{money(a.debt)}</span></div>
        </div>
        {a.debt > 0.5 && <button className="ds-btn pri" onClick={onPay}>Pagar</button>}
      </div>
      <div className="ds-tbl"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th className="r">Importe</th></tr></thead>
        <tbody>{mov.map((m, i) => <tr key={i}><td className="num">{fdate(m.date)}</td><td>{m.t}</td><td className="r num">{m.amt > 0 ? '+' : '−'}{money(Math.abs(m.amt))}</td></tr>)}</tbody></table></div>
    </Modal>
  );
};

const PayModal: React.FC<{ id: string; loc: 'aimogasta' | 'olascoaga'; onClose: () => void }> = ({ id, loc, onClose }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const v = data.providers.find((x) => x.id === id)!;
  const a = providerAccount(data, id);
  const [amount, setAmount] = useState(String(Math.round(a.debt * 100) / 100));
  const [fund, setFund] = useState<Fund | ''>('');
  return (
    <Modal title={'Pagar a ' + v.name} onClose={onClose}
      footer={<><button className="ds-btn" onClick={onClose}>Cancelar</button><button className="ds-btn pri" disabled={busy}
        onClick={() => run(() => payProvider({ providerId: id, providerName: v.name, amount: parseAmount(amount), fund: fund as Fund, loc, debt: a.debt, purchases: a.purchases }), () => 'Pago de ' + money(parseAmount(amount)) + ' registrado desde ' + FUND_LABEL[fund as Fund] + '.').then((r) => { if (r) onClose(); })}>Registrar pago</button></>}>
      <label className="ds-field"><span>Importe</span><AmountInput id="pp-amt" big autoFocus value={amount} onChange={setAmount} /></label>
      <div className="small muted">Debés {money(a.debt)}. El pago se aplica a los ingresos pendientes, del más viejo al más nuevo. Se registra en {LOCS[loc]}.</div>
      <div className="ds-field"><span>¿De dónde sale la plata? (obligatorio)</span><div className="ds-chips">{PAY_FUNDS.map((k) => <button key={k} className={'ds-chip ' + (fund === k ? 'on' : '')} onClick={() => setFund(k)}>{FUND_LABEL[k]}</button>)}</div></div>
    </Modal>
  );
};

const NewProvider: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { run, busy } = useRun();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <Modal title="Nuevo proveedor" onClose={onClose}
      footer={<><button className="ds-btn" onClick={onClose}>Cancelar</button><button className="ds-btn pri" disabled={busy} onClick={() => run(() => createProvider(name, phone), () => 'Proveedor creado.').then((r) => { if (r) onClose(); })}>Guardar</button></>}>
      <label className="ds-field"><span>Nombre</span><input id="np-name" type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} /></label>
      <label className="ds-field"><span>Teléfono (opcional)</span><input id="np-phone" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
    </Modal>
  );
};
