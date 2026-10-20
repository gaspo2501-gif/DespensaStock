import React, { useMemo, useState } from 'react';
import { Loc, LOCS } from '../../core/model';
import { addDays, balances, metrics, Metrics, money, Period, periodRange, today } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { Kpi } from '../common';
import type { ShellApi } from '../Shell';

const Delta: React.FC<{ cur: number; prev: number; label: string; inverse?: boolean }> = ({ cur, prev, label, inverse }) => {
  if (!prev) return <span className="s">Sin datos en {label}</span>;
  const p = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  const good = inverse ? p <= 0 : p >= 0;
  return <span className={'ds-delta ' + (good ? 'up' : 'down')}>{p >= 0 ? '▲ ' : '▼ '}{Math.abs(p)}% <span className="muted" style={{ fontWeight: 500 }}>vs. {label} ({money(prev)})</span></span>;
};

export const ReportesView: React.FC<{ api: ShellApi }> = () => {
  const { data } = useData();
  const T = today();
  const [period, setPeriod] = useState<Period>('month');
  const [loc, setLoc] = useState<Loc | 'all'>('all');
  const [from, setFrom] = useState(addDays(T, -13));
  const [to, setTo] = useState(T);
  const R = periodRange(period, from, to, T);
  const m = useMemo(() => metrics(data, loc, R.a, R.b), [data, loc, R.a, R.b]);
  const pm = useMemo(() => metrics(data, loc, R.pa, R.pb), [data, loc, R.pa, R.pb]);
  const A = useMemo(() => metrics(data, 'aimogasta', R.a, R.b), [data, R.a, R.b]);
  const O = useMemo(() => metrics(data, 'olascoaga', R.a, R.b), [data, R.a, R.b]);
  const debt = Object.values(balances(data)).reduce((t, v) => t + Math.max(0, v), 0);

  const Share: React.FC<{ k: keyof Metrics; label: string }> = ({ k, label }) => {
    const a = A[k] as number, o = O[k] as number, t = a + o;
    const neg = a < 0 || o < 0;
    const pa = t && !neg ? Math.round((a / t) * 100) : 0;
    return (
      <tr>
        <td><b>{label}</b></td><td className="r num">{money(a)}</td><td className="r num">{money(o)}</td><td className="r num"><b>{money(t)}</b></td>
        <td style={{ minWidth: 150 }}>
          {neg ? <span className="small muted">No aplica con valores negativos</span> : <>
            <div className="ds-bar" title={`${LOCS.aimogasta} ${pa}% · ${LOCS.olascoaga} ${t ? 100 - pa : 0}%`}><i style={{ width: pa + '%', background: 'var(--aim)' }} /><i style={{ width: (t ? 100 - pa : 0) + '%', background: 'var(--ola)' }} /></div>
            <div className="small muted num">{t ? pa + '% / ' + (100 - pa) + '%' : '—'}</div>
          </>}
        </td>
      </tr>
    );
  };

  return (
    <>
      <div><h1>Reportes</h1><div className="muted">{R.label} · {loc === 'all' ? 'Las dos sucursales' : LOCS[loc]}</div></div>
      <div className="ds-panel ds-row" style={{ gap: 16 }}>
        <div className="ds-field"><span>Período</span>
          <div className="ds-chips">{([['week', 'Semana'], ['month', 'Mes'], ['lastmonth', 'Mes anterior'], ['today', 'Hoy'], ['range', 'Elegir fechas']] as [Period, string][]).map(([k, l]) => <button key={k} className={'ds-chip ' + (period === k ? 'on' : '')} onClick={() => setPeriod(k)}>{l}</button>)}</div>
        </div>
        {period === 'range' && (
          <div className="ds-row">
            <label className="ds-field"><span>Desde</span><input id="rep-from" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
            <label className="ds-field"><span>Hasta</span><input id="rep-to" type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          </div>
        )}
        <div className="ds-field"><span>Sucursal (solo para ver, no cambia dónde trabajás)</span>
          <div className="ds-seg">{([['all', 'Total'], ['aimogasta', LOCS.aimogasta], ['olascoaga', LOCS.olascoaga]] as [Loc | 'all', string][]).map(([k, l]) => <button key={k} className={loc === k ? 'on' : ''} onClick={() => setLoc(k)}>{k !== 'all' && <span className={'ds-dot d-' + k} />}{l}</button>)}</div>
        </div>
      </div>
      <div className="ds-grid g4">
        <Kpi label="Vendido (facturación)" value={money(m.sold)}><Delta cur={m.sold} prev={pm.sold} label={R.prevLabel} /><span className="s">{m.salesCount} ventas · {money(m.credit)} quedó fiado</span></Kpi>
        <Kpi label="Cobrado (plata que entró)" value={money(m.collected)}><Delta cur={m.collected} prev={pm.collected} label={R.prevLabel} /><span className="s">Incluye {money(m.collectedDebt)} de fiados anteriores</span></Kpi>
        <Kpi label="Compra de mercadería" value={money(m.purchases)}><Delta cur={m.purchases} prev={pm.purchases} label={R.prevLabel} inverse /></Kpi>
        <Kpi label="Gastos operativos" value={money(m.expenses)}><Delta cur={m.expenses} prev={pm.expenses} label={R.prevLabel} inverse /></Kpi>
      </div>
      <div className="ds-grid g2">
        <div className="ds-panel">
          <div className="ds-panel-h"><h2>Resultado del período</h2><span className={'ds-pill num ' + (m.result >= 0 ? 'p-ok' : 'p-bad')}>{money(m.result)}</span></div>
          <div className="ds-cmp">
            <span>Vendido</span><b className="num">{money(m.sold)}</b>
            <span>Menos costo de lo vendido</span><b className="num">− {money(m.cogs)}</b>
            <span>Menos gastos operativos</span><b className="num">− {money(m.expenses)}</b>
            <span className="ds-total-line"><b>Ganancia</b></span><b className="num ds-total-line" style={{ color: m.result >= 0 ? 'var(--cash)' : 'var(--danger)' }}>{money(m.result)}</b>
          </div>
          <div className="ds-note" style={{ marginTop: 12 }}>
            Compara lo vendido contra lo que <b>costó eso que vendiste</b>, no contra la mercadería que compraste en el período. Una compra grande para stockearte no hace que el mes dé negativo.
            {m.estimatedItems > 0 && <> En {m.estimatedItems} productos vendidos antes de esta versión no estaba guardado el costo; para esos se usó el costo actual (estimado).</>}
          </div>
        </div>
        <div className="ds-panel">
          <div className="ds-panel-h"><h2>Más vendidos</h2></div>
          {m.top.length ? <div className="ds-list">{m.top.map((x, i) => <div className="ds-li" key={i}><span className="grow trunc">{x.name}</span><span className="small muted num">{x.qty} u.</span><b className="num">{money(x.amount)}</b></div>)}</div> : <div className="ds-empty">Sin ventas en el período.</div>}
          <div className="small muted" style={{ marginTop: 10 }}>Fiado pendiente de cobro hoy: <b className="num">{money(debt)}</b></div>
        </div>
      </div>
      <div className="ds-panel">
        <div className="ds-panel-h"><h2>Cuánto pone cada sucursal</h2><span className="small muted"><span className="ds-dot d-aimogasta" />{LOCS.aimogasta} &nbsp;<span className="ds-dot d-olascoaga" />{LOCS.olascoaga}</span></div>
        <div className="ds-tbl"><table>
          <thead><tr><th /><th className="r">{LOCS.aimogasta}</th><th className="r">{LOCS.olascoaga}</th><th className="r">Total</th><th>Participación</th></tr></thead>
          <tbody><Share k="sold" label="Vendido" /><Share k="collected" label="Cobrado" /><Share k="purchases" label="Mercadería" /><Share k="expenses" label="Gastos" /><Share k="result" label="Resultado" /></tbody>
        </table></div>
      </div>
    </>
  );
};
