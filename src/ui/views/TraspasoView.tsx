import React, { useMemo, useState } from 'react';
import { Loc, LOCS, otherLoc, Product, StockTransfer } from '../../core/model';
import { fdate, lowStock, parseAmount } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { transferStockBatch } from '../../data/ops';
import { AmountInput, Icon, LocDot, Modal, useRun, useToast } from '../common';
import { ScannerModal } from '../SaleDetail';
import type { ShellApi } from '../Shell';

interface TLine { pid: string; qty: string }
interface Group { id: string; date: string; createdAt: string; from: Loc; to: Loc; items: StockTransfer[] }

/** Traspaso de stock entre sucursales: se arma la lista completa y se pasa todo junto. */
export const TraspasoView: React.FC<{ api: ShellApi }> = ({ api }) => {
  const { data, sync } = useData();
  const toast = useToast();
  const { run, busy } = useRun();
  const [from, setFrom] = useState<Loc>(api.loc);
  const to = otherLoc(from);
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<TLine[]>([]);
  const [modal, setModal] = useState<null | { kind: 'scan' } | { kind: 'detail'; id: string }>(null);
  const byId = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return data.products.filter((p) => !p.archived && (p.name.toLowerCase().includes(s) || p.barcode.includes(s) || p.brand.toLowerCase().includes(s))).slice(0, 6);
  }, [q, data.products]);

  // Si el producto ya está en la lista, escanearlo otra vez suma 1.
  const addProduct = (p: Product, qty = 1) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.pid === p.id);
      if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, qty: String(Math.round(parseAmount(l.qty)) + qty) } : l));
      return [...ls, { pid: p.id, qty: String(qty) }];
    });
    setQ('');
  };
  const onCode = (code: string) => {
    const c = code.trim(); if (!c) return;
    const p = data.products.find((x) => !x.archived && x.barcode === c);
    if (p) return addProduct(p);
    if (results.length === 1) return addProduct(results[0]);
    if (/^\d{6,14}$/.test(c)) toast('No hay ningún producto con el código ' + c + '.', 'warn');
  };

  // Productos bajo mínimo en el destino que tienen stock en el origen.
  const missing = useMemo(() => lowStock(data.products, to).filter((p) => p.stock[from] > 0), [data.products, from, to]);
  const addMissing = () => {
    const have = new Set(lines.map((l) => l.pid));
    const add = missing.filter((p) => !have.has(p.id)).map((p) => {
      const need = Math.max(1, p.min - Math.max(0, p.stock[to]));
      return { pid: p.id, qty: String(Math.min(p.stock[from], need)) };
    });
    setLines([...lines, ...add]);
    toast(add.length ? 'Se agregaron ' + add.length + ' productos. Revisá las cantidades.' : 'Ya estaban todos en la lista.');
  };

  const upd = (i: number, qty: string) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, qty } : l)));
  const parsed = lines.map((l) => ({ l, p: byId.get(l.pid), qty: Math.round(parseAmount(l.qty)) }));
  const problems = parsed.filter((x) => !x.p || !(x.qty > 0) || x.qty > (x.p?.stock[from] ?? 0));
  const units = parsed.reduce((t, x) => t + (x.qty > 0 ? x.qty : 0), 0);

  const swap = () => {
    if (lines.length && !window.confirm('¿Cambiar el sentido del traspaso? La lista se mantiene.')) return;
    setFrom(to);
  };

  const save = () => {
    if (problems.length) return toast('Revisá las cantidades marcadas en rojo.', 'err');
    run(() => transferStockBatch({ from, lines: parsed.map((x) => ({ product: x.p!, qty: x.qty })) }),
      (r) => `Traspaso hecho: ${r.count} ${r.count === 1 ? 'producto' : 'productos'} (${r.units} unidades) de ${LOCS[from]} a ${LOCS[r.to]}.`)
      .then((r) => { if (r) setLines([]); });
  };

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const t of data.transfers) {
      const k = t.groupId || t.id;
      const g = m.get(k) || { id: k, date: t.date, createdAt: t.createdAt, from: t.from, to: t.to, items: [] };
      g.items.push(t); m.set(k, g);
    }
    return [...m.values()].sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date)).slice(0, 40);
  }, [data.transfers]);
  const detail = modal?.kind === 'detail' ? groups.find((g) => g.id === modal.id) : undefined;

  return (
    <>
      <div className="ds-row spread"><div><h1>Traspaso de stock</h1><div className="muted">Armá la lista completa y pasala toda junta</div></div></div>
      <div className="ds-panel">
        <div className="ds-row ds-tdir" style={{ marginBottom: 12 }}>
          <div className="ds-field"><span>Sale de</span><b className="ds-tloc"><LocDot loc={from} />{LOCS[from]}</b></div>
          <button className="ds-btn" onClick={swap} aria-label="Cambiar el sentido" title="Cambiar el sentido">⇄</button>
          <div className="ds-field"><span>Entra a</span><b className="ds-tloc"><LocDot loc={to} />{LOCS[to]}</b></div>
        </div>
        <div className="ds-grid g2" style={{ marginBottom: 12, alignItems: 'end' }}>
          <div className="ds-field"><span>Agregar producto</span>
            <div className="ds-row" style={{ flexWrap: 'nowrap' }}>
              <input id="tr-q" type="search" autoComplete="off" placeholder="Buscar o escanear código" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCode(q); } }} />
              <button className="ds-btn" onClick={() => setModal({ kind: 'scan' })} title="Escanear con la cámara"><Icon name="scan" /></button>
            </div>
            {q.trim() && (
              <div className="ds-results">
                {results.map((p) => <button key={p.id} onClick={() => addProduct(p)}><span style={{ flex: 1, minWidth: 0 }} className="trunc">{p.name}</span><span className="small muted">{LOCS[from]}: {p.stock[from]} · {LOCS[to]}: {p.stock[to]}</span></button>)}
                {!results.length && <div className="small muted" style={{ padding: 8 }}>No se encontró ningún producto.</div>}
              </div>
            )}
          </div>
          <div>
            {missing.length > 0
              ? <button className="ds-btn" onClick={addMissing}>Agregar lo que falta en {LOCS[to]} ({missing.length})</button>
              : <div className="small muted">No hay productos bajo mínimo en {LOCS[to]} con stock en {LOCS[from]}.</div>}
          </div>
        </div>

        {!lines.length ? <div className="ds-empty">Agregá todos los productos que pasás, con su cantidad. Al final confirmás y se pasa todo junto.</div> : (
          <div className="ds-list">
            {parsed.map(({ l, p, qty }, i) => {
              if (!p) return null;
              const over = qty > p.stock[from];
              const ok = qty > 0 && !over;
              return (
                <div className="ds-li ds-tline" key={l.pid}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="trunc" style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="small muted">Hay {p.stock[from]} en {LOCS[from]} · {p.stock[to]} en {LOCS[to]}</div>
                    {over && <div className="small" style={{ color: 'var(--danger)', fontWeight: 600 }}>En {LOCS[from]} hay solo {p.stock[from]}.</div>}
                    {!over && !(qty > 0) && <div className="small" style={{ color: 'var(--danger)', fontWeight: 600 }}>Poné la cantidad.</div>}
                    {ok && <div className="small muted">Quedan {p.stock[from] - qty} en {LOCS[from]} y {p.stock[to] + qty} en {LOCS[to]}</div>}
                  </div>
                  <div className="ds-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <button className="ds-btn sm" onClick={() => upd(i, String(Math.max(1, qty - 1)))} aria-label="Uno menos">−</button>
                    <AmountInput id={'tq-' + i} value={l.qty} onChange={(v) => upd(i, v)} ariaLabel={'Cantidad de ' + p.name} className={over || !(qty > 0) ? 'bad' : ''} />
                    <button className="ds-btn sm" onClick={() => upd(i, String(qty + 1))} aria-label="Uno más">+</button>
                    <button className="ds-btn ghost sm" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))} aria-label="Quitar">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="ds-row spread" style={{ marginTop: 16 }}>
          <div className="muted">{lines.length ? <><b>{lines.length}</b> {lines.length === 1 ? 'producto' : 'productos'} · <b className="num">{units}</b> unidades</> : ''}</div>
          <div className="ds-row">
            {lines.length > 0 && <button className="ds-btn ghost" onClick={() => { if (window.confirm('¿Vaciar la lista?')) setLines([]); }}>Vaciar lista</button>}
            <button className="ds-btn pri ds-confirm" disabled={busy || !lines.length || !sync.online} onClick={save}>{busy ? 'Pasando…' : 'Confirmar traspaso'}</button>
          </div>
        </div>
        {!sync.online && <div className="ds-note">Sin conexión: podés armar la lista, pero para confirmar el traspaso hace falta internet.</div>}
      </div>

      <div className="ds-panel">
        <div className="ds-panel-h"><h2>Traspasos recientes</h2></div>
        {groups.length ? (
          <div className="ds-tbl"><table>
            <thead><tr><th>Fecha</th><th>Sentido</th><th className="r">Productos</th><th className="r">Unidades</th></tr></thead>
            <tbody>{groups.map((g) => (
              <tr key={g.id} className="click" onClick={() => setModal({ kind: 'detail', id: g.id })}>
                <td className="num">{fdate(g.date)}</td>
                <td>{LOCS[g.from]} → {LOCS[g.to]}<div className="small muted trunc" style={{ maxWidth: 360 }}>{g.items.map((t) => t.qty + '× ' + t.productName).join(', ')}</div></td>
                <td className="r num">{g.items.length}</td>
                <td className="r num">{g.items.reduce((t, x) => t + x.qty, 0)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="ds-empty">Todavía no hay traspasos registrados.</div>}
      </div>

      {modal?.kind === 'scan' && <ScannerModal onClose={() => setModal(null)} onCode={onCode} />}
      {detail && (
        <Modal title={'Traspaso del ' + fdate(detail.date)} onClose={() => setModal(null)}>
          <div className="muted">De {LOCS[detail.from]} a {LOCS[detail.to]}{detail.createdAt ? ' · ' + new Date(detail.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
          <div className="ds-tbl"><table>
            <thead><tr><th>Producto</th><th className="r">Cant.</th></tr></thead>
            <tbody>{detail.items.map((t) => <tr key={t.id}><td>{t.productName}</td><td className="r num">{t.qty}</td></tr>)}</tbody>
          </table></div>
          <div className="small muted">Si hubo un error, hacé otro traspaso en sentido contrario con lo que haya que devolver.</div>
        </Modal>
      )}
    </>
  );
};
