import React, { useMemo, useState } from 'react';
import { DEFAULT_MARGIN, Fund, FUND_LABEL, LOCS, MARGINS, PAY_FUNDS, Product } from '../../core/model';
import { fdate, money, parseAmount, priceFromCost, purchaseState } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { cancelPurchase, createPurchase } from '../../data/ops';
import { AmountInput, Icon, LocName, Modal, useRun, useToast } from '../common';
import { ProductFormModal } from '../ProductForm';
import { ScannerModal } from '../SaleDetail';
import type { ShellApi } from '../Shell';

interface PLine { pid: string; qty: string; cost: string; margin: number; custom: boolean; price: string; edited: boolean }
const STATE: Record<string, [string, string]> = { PAID: ['Pagado', 'p-ok'], PARTIAL: ['Pago parcial', 'p-warn'], PENDING: ['Pendiente', 'p-bad'], CANCELLED: ['Anulado', 'p-neu'] };

export const ComprasView: React.FC<{ api: ShellApi }> = ({ api }) => {
  const { data } = useData();
  const toast = useToast();
  const { run, busy } = useRun();
  const loc = api.loc;
  const [providerId, setProviderId] = useState('');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<PLine[]>([]);
  const [payMode, setPayMode] = useState<'all' | 'partial' | 'pending'>('all');
  const [partial, setPartial] = useState('');
  const [fund, setFund] = useState<Fund | ''>('');
  const [modal, setModal] = useState<null | { kind: 'new'; code?: string } | { kind: 'detail'; id: string } | { kind: 'scan' }>(null);
  const byId = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return data.products.filter((p) => !p.archived && (p.name.toLowerCase().includes(s) || p.barcode.includes(s) || p.brand.toLowerCase().includes(s))).slice(0, 6);
  }, [q, data.products]);

  const addProduct = (p: Product) => {
    setLines((ls) => ls.some((l) => l.pid === p.id) ? ls : [...ls, { pid: p.id, qty: '1', cost: p.cost ? String(p.cost) : '', margin: DEFAULT_MARGIN, custom: false, price: p.cost ? String(priceFromCost(p.cost, DEFAULT_MARGIN)) : '', edited: false }]);
    setQ('');
  };
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  React.useEffect(() => { if (pendingAdd) { const p = byId.get(pendingAdd); if (p) { addProduct(p); setPendingAdd(null); } } }, [pendingAdd, byId]);

  const onCode = (code: string) => {
    const c = code.trim(); if (!c) return;
    const p = data.products.find((x) => !x.archived && x.barcode === c);
    if (p) return addProduct(p);
    if (/^\d{6,14}$/.test(c)) { setQ(''); setModal({ kind: 'new', code: c }); }
    else if (results.length === 1) addProduct(results[0]);
  };

  const upd = (i: number, patch: Partial<PLine>) => setLines((ls) => ls.map((l, k) => {
    if (k !== i) return l;
    const n = { ...l, ...patch };
    if (!n.edited && ('cost' in patch || 'margin' in patch)) n.price = String(priceFromCost(parseAmount(n.cost), n.margin) || '');
    return n;
  }));

  const total = lines.reduce((t, l) => t + parseAmount(l.qty) * parseAmount(l.cost), 0);
  const paid = payMode === 'all' ? total : payMode === 'partial' ? parseAmount(partial) : 0;
  const provider = data.providers.find((v) => v.id === providerId);

  const save = () => {
    if (payMode === 'partial' && !(paid > 0 && paid < total)) return toast('El pago parcial tiene que ser mayor a $0 y menor al total.', 'err');
    run(() => createPurchase({
      providerId, providerName: provider?.name || '', loc, paid, fund: paid > 0 ? (fund || undefined) : undefined,
      lines: lines.map((l) => { const product = byId.get(l.pid)!; const cost = parseAmount(l.cost); return { product, qty: Math.round(parseAmount(l.qty)), unitCost: cost, margin: l.margin, price: parseAmount(l.price), suggested: priceFromCost(cost, l.margin) }; }),
    }), (r) => 'Ingreso confirmado: ' + money(r.total) + (r.paid < r.total - 0.5 ? ' · queda debiendo ' + money(r.total - r.paid) : ' · pagado') + (r.queued ? ' · guardado en este equipo' : ''))
      .then((r) => { if (r) { setLines([]); setPayMode('all'); setPartial(''); setFund(''); setProviderId(''); } });
  };

  const hist = [...data.purchases].sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date)).slice(0, 60);

  return (
    <>
      <div className="ds-row spread"><div><h1>Ingreso de mercadería</h1><div className="muted">Entra al stock de <LocName loc={loc} /></div></div></div>
      <div className="ds-panel">
        <div className="ds-grid g2" style={{ marginBottom: 12 }}>
          <label className="ds-field"><span>Proveedor</span>
            <select id="pur-prov" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">Elegí el proveedor</option>
              {data.providers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <div className="ds-field"><span>Agregar producto</span>
            <div className="ds-row" style={{ flexWrap: 'nowrap' }}>
              <input id="pur-q" type="search" autoComplete="off" placeholder="Buscar o escanear código" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCode(q); } }} />
              <button className="ds-btn" onClick={() => setModal({ kind: 'scan' })} title="Escanear con la cámara"><Icon name="scan" /></button>
            </div>
            {q.trim() && (
              <div className="ds-results">
                {results.map((p) => <button key={p.id} onClick={() => addProduct(p)}><span style={{ flex: 1, minWidth: 0 }} className="trunc">{p.name}</span><span className="small muted">Costo {p.cost ? money(p.cost) : '—'}</span></button>)}
                <button onClick={() => { setModal({ kind: 'new', code: /^\d{6,14}$/.test(q.trim()) ? q.trim() : undefined }); setQ(''); }}><span style={{ color: 'var(--accent)', fontWeight: 700 }}>+ Producto nuevo</span></button>
              </div>
            )}
          </div>
        </div>

        {!lines.length ? <div className="ds-empty">Agregá los productos que entraron. Cargás el costo y la app calcula el precio con el margen que elijas.</div> : (
          <>
            <div className="ds-pline hide-m" style={{ padding: '0 0 6px' }}><span className="ds-label">Producto</span><span className="ds-label">Cant.</span><span className="ds-label">Costo unit.</span><span className="ds-label">Margen de ganancia</span><span className="ds-label">Precio de venta</span><span /></div>
            {lines.map((l, i) => {
              const p = byId.get(l.pid); if (!p) return null;
              const c = parseAmount(l.cost); const prev = p.cost;
              const pct = prev && c > 0 && c !== prev ? Math.round(((c - prev) / prev) * 100) : 0;
              return (
                <div className="ds-pline" key={l.pid}>
                  <div className="pn" style={{ minWidth: 0 }}><div className="trunc" style={{ fontWeight: 600 }}>{p.name}</div><div className="small muted">Precio actual {p.price ? money(p.price) : 'sin precio'} · stock {p.stock[loc]}</div></div>
                  <AmountInput id={'pq-' + i} value={l.qty} onChange={(v) => upd(i, { qty: v })} ariaLabel="Cantidad" />
                  <div>
                    <AmountInput id={'pc-' + i} value={l.cost} onChange={(v) => upd(i, { cost: v })} placeholder="Costo" ariaLabel="Costo unitario" />
                    {prev && c > 0 && c !== prev && (c > prev
                      ? <div className="ds-costchg down">▲ Subió {pct}% (antes {money(prev)})</div>
                      : <div className="ds-costchg up">▼ Bajó {Math.abs(pct)}% (antes {money(prev)})</div>)}
                  </div>
                  <div className="ds-margins">
                    {MARGINS.map((m) => <button key={m} className={l.margin === m && !l.custom ? 'on' : ''} onClick={() => upd(i, { margin: m, custom: false, edited: false })}>{m}%</button>)}
                    <AmountInput id={'pm-' + i} value={l.custom ? String(l.margin) : ''} placeholder="Otro %" ariaLabel="Otro margen"
                      onChange={(v) => { const m = parseAmount(v); if (m > 0 && m < 90) upd(i, { margin: m, custom: true, edited: false }); else if (v === '') upd(i, { margin: DEFAULT_MARGIN, custom: false, edited: false }); }} />
                  </div>
                  <div>
                    <AmountInput id={'pp-' + i} value={l.price} onChange={(v) => upd(i, parseAmount(v) > 0 ? { price: v, edited: true } : { price: v, edited: false })} ariaLabel="Precio de venta" className="strong" />
                    <div className="small muted">{l.edited ? 'Precio a mano' : 'Calculado con ' + l.margin + '%'}</div>
                  </div>
                  <button className="ds-btn ghost sm" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))} aria-label="Quitar">✕</button>
                </div>
              );
            })}
          </>
        )}

        <div className="ds-grid g2" style={{ marginTop: 16, alignItems: 'start' }}>
          <div>
            <div className="ds-label" style={{ marginBottom: 6 }}>Pago al proveedor</div>
            <div className="ds-chips">{([['all', 'Pagué todo'], ['partial', 'Pagué una parte'], ['pending', 'Queda pendiente']] as const).map(([k, l]) => <button key={k} className={'ds-chip ' + (payMode === k ? 'on' : '')} onClick={() => setPayMode(k)}>{l}</button>)}</div>
            <div className="ds-col" style={{ marginTop: 10 }}>
              {payMode === 'partial' && <label className="ds-field"><span>¿Cuánto pagaste?</span><AmountInput id="pur-partial" value={partial} onChange={setPartial} /></label>}
              {payMode !== 'pending'
                ? <div className="ds-field"><span>¿De dónde salió la plata? (obligatorio)</span><div className="ds-chips">{PAY_FUNDS.map((k) => <button key={k} className={'ds-chip ' + (fund === k ? 'on' : '')} onClick={() => setFund(k)}>{FUND_LABEL[k]}</button>)}</div></div>
                : <div className="ds-note">El total queda como deuda en la cuenta del proveedor.</div>}
            </div>
          </div>
          <div className="ds-panel soft">
            <div className="ds-cmp"><span>Total del ingreso</span><b className="num" style={{ fontSize: '1.3rem' }}>{money(total)}</b></div>
            <button className="ds-btn pri ds-confirm" style={{ marginTop: 12 }} disabled={busy || !lines.length} onClick={save}>{busy ? 'Guardando…' : 'Confirmar ingreso'}</button>
          </div>
        </div>
      </div>

      <div className="ds-panel">
        <div className="ds-panel-h"><h2>Ingresos registrados</h2></div>
        {hist.length ? (
          <div className="ds-tbl"><table>
            <thead><tr><th>Fecha</th><th>Proveedor</th><th className="hide-m">Sucursal</th><th className="r">Total</th><th className="r hide-m">Pagado</th><th>Estado</th></tr></thead>
            <tbody>{hist.map((p) => { const st = STATE[purchaseState(p)]; return (
              <tr key={p.id} className={'click ' + (p.status === 'CANCELLED' ? 'cancel' : '')} onClick={() => setModal({ kind: 'detail', id: p.id })}>
                <td className="num">{fdate(p.date)}</td><td>{p.providerName}</td><td className="hide-m">{LOCS[p.loc]}</td>
                <td className="r num">{money(p.total)}</td><td className="r num hide-m">{money(p.paidAmount)}</td><td><span className={'ds-pill ' + st[1]}>{st[0]}</span></td>
              </tr>); })}</tbody>
          </table></div>
        ) : <div className="ds-empty">Todavía no hay ingresos registrados.</div>}
      </div>

      {modal?.kind === 'scan' && <ScannerModal onClose={() => setModal(null)} onCode={onCode} />}
      {modal?.kind === 'new' && <ProductFormModal loc={loc} initialBarcode={modal.code} hideStock onClose={() => setModal(null)} onSaved={(id) => setPendingAdd(id)} />}
      {modal?.kind === 'detail' && <PurchaseDetail id={modal.id} onClose={() => setModal(null)} />}
    </>
  );
};

const PurchaseDetail: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [reason, setReason] = useState('');
  const p = data.purchases.find((x) => x.id === id);
  if (!p) return null;
  const items = data.purchaseItems.filter((i) => i.purchaseId === id);
  const pays = data.spays.filter((x) => x.purchaseId === id);
  const activePays = pays.filter((x) => x.status !== 'CANCELLED');
  const st = STATE[purchaseState(p)];
  return (
    <Modal title={'Ingreso del ' + fdate(p.date) + ' · ' + p.providerName} onClose={onClose} wide>
      <div className="ds-row" style={{ gap: 6 }}><span className={'ds-pill p-' + p.loc}>{LOCS[p.loc]}</span><span className={'ds-pill ' + st[1]}>{st[0]}</span></div>
      <div className="ds-tbl"><table>
        <thead><tr><th>Producto</th><th className="r">Cant.</th><th className="r">Costo</th><th className="r">Antes</th><th className="r">Margen</th><th className="r">Precio</th></tr></thead>
        <tbody>{items.map((i) => <tr key={i.id}><td>{i.name}</td><td className="r num">{i.qty}</td><td className="r num">{money(i.unitCost)}</td><td className={'r num ' + (i.previousCost && i.unitCost > i.previousCost ? 'down' : 'muted')}>{i.previousCost ? money(i.previousCost) : '—'}</td><td className="r num">{i.margin ? i.margin + '%' : '—'}</td><td className="r num">{money(i.finalSalePrice)}</td></tr>)}</tbody>
      </table></div>
      <div className="ds-cmp"><span>Total</span><b className="num">{money(p.total)}</b><span>Pagado</span><b className="num">{money(p.paidAmount)}</b></div>
      {pays.length > 0 && <div className="small muted">Pagos: {pays.map((x) => money(x.amount) + ' desde ' + FUND_LABEL[x.fund] + (x.status === 'CANCELLED' ? ' (anulado, la plata volvió)' : '')).join(' · ')}</div>}
      {p.status !== 'CANCELLED' && (
        <details>
          <summary>Anular este ingreso</summary>
          <div className="ds-col" style={{ marginTop: 8 }}>
            <label className="ds-field"><span>Motivo</span><input id="cp-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: se cargó dos veces" /></label>
            <div className="small muted">Se descuenta del stock de {LOCS[p.loc]} lo que entró{activePays.length ? ' y se anulan los pagos: ' + money(activePays.reduce((t, x) => t + x.amount, 0)) + ' vuelven a ' + [...new Set(activePays.map((x) => FUND_LABEL[x.fund]))].join(' y ') : ''}. Los precios y costos de los productos no se cambian.</div>
            <button className="ds-btn danger" style={{ alignSelf: 'flex-start' }} disabled={busy}
              onClick={() => run(() => cancelPurchase(p.id, reason), (r) => 'Ingreso anulado. Se descontó el stock' + (r.returned ? ' y volvieron ' + money(r.returned) + ' a la caja.' : '.')).then((r) => { if (r) onClose(); })}>Anular ingreso</button>
          </div>
        </details>
      )}
    </Modal>
  );
};
