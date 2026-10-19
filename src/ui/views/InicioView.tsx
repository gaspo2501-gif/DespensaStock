import React, { useMemo } from 'react';
import { LOCS, Loc, otherLoc } from '../../core/model';
import { balances, dayCash, fdateL, lowStock, money, stockLevel, today } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { copyText, Kpi, LocDot, useToast } from '../common';
import type { ShellApi } from '../Shell';

const LEVEL: Record<string, [string, string]> = { negative: ['Revisar', 'p-bad'], zero: ['Sin stock', 'p-bad'], low: ['Bajo mínimo', 'p-warn'], ok: ['OK', 'p-ok'] };

export const InicioView: React.FC<{ api: ShellApi }> = ({ api }) => {
  const { data } = useData();
  const toast = useToast();
  const T = today();
  const d = useMemo(() => dayCash(data, api.loc, T), [data, api.loc, T]);
  const bal = useMemo(() => balances(data), [data]);
  const debt = Object.values(bal).reduce((t, v) => t + Math.max(0, v), 0);
  const debtors = Object.values(bal).filter((v) => v > 0.5).length;
  const negatives = data.products.filter((p) => !p.archived && (p.stock.aimogasta < 0 || p.stock.olascoaga < 0));
  const noPrice = data.products.filter((p) => !p.archived && !p.price).length;
  const orderLoc = [api.loc, otherLoc(api.loc)] as Loc[];

  const Col: React.FC<{ loc: Loc }> = ({ loc }) => {
    const L = lowStock(data.products, loc);
    const zero = L.filter((p) => p.stock[loc] <= 0).length;
    return (
      <div className="ds-panel">
        <div className="ds-panel-h">
          <h2><LocDot loc={loc} />Para reponer en {LOCS[loc]}</h2>
          <div className="ds-row" style={{ gap: 6 }}><span className="ds-pill p-bad">{zero} sin stock</span><span className="ds-pill p-warn">{L.length - zero} bajo mínimo</span></div>
        </div>
        {L.length ? (
          <>
            <div className="ds-list ds-scroll">
              {L.map((p) => {
                const lv = LEVEL[stockLevel(p, loc)];
                return (
                  <div className="ds-li" key={p.id}>
                    <div className="grow">
                      <div className="trunc" style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="small muted">Quedan <b className="num">{p.stock[loc]}</b> · mínimo {p.min} · en {LOCS[otherLoc(loc)]}: {p.stock[otherLoc(loc)]}</div>
                    </div>
                    <span className={'ds-pill ' + lv[1]}>{lv[0]}</span>
                  </div>
                );
              })}
            </div>
            <div className="ds-row" style={{ marginTop: 12 }}>
              <button className="ds-btn sm" onClick={() => copyText('Reponer en ' + LOCS[loc] + ':\n' + L.map((p) => '- ' + p.name + ' (quedan ' + Math.max(0, p.stock[loc]) + ')').join('\n'), toast)}>Copiar lista para el mayorista</button>
            </div>
          </>
        ) : <div className="ds-empty">Nada para reponer en {LOCS[loc]}.</div>}
      </div>
    );
  };

  return (
    <>
      <div className="ds-row spread">
        <div><h1>Inicio</h1><div className="muted">{fdateL(T)}</div></div>
        <button className="ds-btn pri" onClick={() => api.go('venta')}>Nueva venta</button>
      </div>
      {negatives.length > 0 && (
        <div className="ds-panel" style={{ borderColor: 'var(--danger)' }}>
          <b style={{ color: 'var(--danger)' }}>Stock negativo para revisar:</b> {negatives.map((p) => p.name).join(', ')}.{' '}
          <span className="muted small">Pasa cuando se vende sin internet en las dos sucursales a la vez. Corregilo desde Stock.</span>
        </div>
      )}
      <div className="ds-grid g2">{orderLoc.map((l) => <Col key={l} loc={l} />)}</div>
      <div className="ds-grid g4">
        <Kpi label={'Vendido hoy en ' + LOCS[api.loc]} value={money(d.sold)} sub={d.salesCount + ' ventas'} />
        <Kpi label="Efectivo en el cajón" value={money(d.drawer)} sub="Según lo registrado hoy" />
        <Kpi label="Entró por Mercado Pago hoy" value={money(d.mpIn)} />
        <Kpi label="Fiado por cobrar (total)" value={money(debt)} sub={debtors === 1 ? '1 cliente debe' : debtors + ' clientes deben'} />
      </div>
      {noPrice > 0 && <div className="ds-note">{noPrice === 1 ? '1 producto no tiene' : noPrice + ' productos no tienen'} precio de venta. Se completan en Stock o al venderlos.</div>}
    </>
  );
};
