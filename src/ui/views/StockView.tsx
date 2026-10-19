import React, { useMemo, useState } from 'react';
import { Loc, LOCS, LOC_IDS, Product, otherLoc } from '../../core/model';
import { money, parseAmount, stockLevel } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { adjustStock, archiveProduct, transferStock } from '../../data/ops';
import { AmountInput, Icon, Modal, useRun } from '../common';
import { ProductFormModal } from '../ProductForm';
import { ScannerModal } from '../SaleDetail';
import type { ShellApi } from '../Shell';

const LEVEL: Record<string, [string, string]> = { negative: ['Revisar', 'p-bad'], zero: ['Sin stock', 'p-bad'], low: ['Bajo mínimo', 'p-warn'], ok: ['OK', 'p-ok'] };
type Filter = 'all' | 'zero' | 'low' | 'noprice';

export const StockView: React.FC<{ api: ShellApi }> = ({ api }) => {
  const { data } = useData();
  const [loc, setLoc] = useState<Loc>(api.loc);
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const [modal, setModal] = useState<null | { kind: 'new'; code?: string } | { kind: 'view'; id: string } | { kind: 'edit'; id: string } | { kind: 'scan' }>(null);
  const products = data.products.filter((p) => !p.archived);
  const test = (p: Product, k: Filter) => k === 'all' || (k === 'zero' && p.stock[loc] <= 0) || (k === 'low' && p.stock[loc] > 0 && p.stock[loc] <= p.min) || (k === 'noprice' && !p.price);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => (!s || p.name.toLowerCase().includes(s) || p.barcode.includes(s) || p.brand.toLowerCase().includes(s)) && test(p, f));
  }, [q, f, loc, data.products]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScan = (code: string) => {
    const p = products.find((x) => x.barcode === code);
    if (p) setModal({ kind: 'view', id: p.id }); else setModal({ kind: 'new', code });
  };

  return (
    <>
      <div className="ds-row spread">
        <div><h1>Stock</h1><div className="muted">{products.length} productos activos</div></div>
        <div className="ds-row"><button className="ds-btn" onClick={() => setModal({ kind: 'scan' })}><Icon name="scan" />Escanear</button><button className="ds-btn pri" onClick={() => setModal({ kind: 'new' })}>Nuevo producto</button></div>
      </div>
      <div className="ds-panel">
        <div className="ds-row" style={{ marginBottom: 12 }}>
          <input id="stock-q" type="search" placeholder="Buscar por nombre, marca o código" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { const p = products.find((x) => x.barcode === q.trim()); if (p) setModal({ kind: 'view', id: p.id }); else if (/^\d{6,14}$/.test(q.trim())) setModal({ kind: 'new', code: q.trim() }); } }}
            style={{ maxWidth: 320 }} />
          <div className="ds-seg">{LOC_IDS.map((l) => <button key={l} className={loc === l ? 'on' : ''} onClick={() => setLoc(l)}><span className={'ds-dot d-' + l} />{LOCS[l]}</button>)}</div>
          <div className="ds-chips">
            {([['all', 'Todos'], ['zero', 'Sin stock'], ['low', 'Bajo mínimo'], ['noprice', 'Sin precio']] as [Filter, string][]).map(([k, l]) => (
              <button key={k} className={'ds-chip ' + (f === k ? 'on' : '')} onClick={() => setF(k)}>{l} <span className="num">{products.filter((p) => test(p, k)).length}</span></button>
            ))}
          </div>
        </div>
        {list.length ? (
          <div className="ds-tbl"><table>
            <thead><tr><th>Producto</th><th className="hide-m">Código</th><th className="r">Precio</th><th className="r hide-m">Costo</th><th className="r">{LOCS.aimogasta}</th><th className="r">{LOCS.olascoaga}</th><th className="r hide-m">Mínimo</th><th>Estado en {LOCS[loc]}</th></tr></thead>
            <tbody>{list.slice(0, 400).map((p) => {
              const lv = LEVEL[stockLevel(p, loc)];
              return (
                <tr key={p.id} className="click" onClick={() => setModal({ kind: 'view', id: p.id })}>
                  <td><b>{p.name}</b><div className="small muted">{[p.brand, p.presentation, p.category].filter(Boolean).join(' · ')}</div></td>
                  <td className="hide-m num muted">{p.barcode}</td>
                  <td className="r num">{p.price ? money(p.price) : <span className="ds-pill p-warn">Sin precio</span>}</td>
                  <td className="r num hide-m muted">{p.cost ? money(p.cost) : '—'}</td>
                  <td className="r num" style={loc === 'aimogasta' ? { fontWeight: 700 } : undefined}>{p.stock.aimogasta}</td>
                  <td className="r num" style={loc === 'olascoaga' ? { fontWeight: 700 } : undefined}>{p.stock.olascoaga}</td>
                  <td className="r num hide-m">{p.min}{p.minIsDefault && <span className="muted small"> *</span>}</td>
                  <td><span className={'ds-pill ' + lv[1]}>{lv[0]}</span></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="ds-empty">No hay productos con este filtro.</div>}
        {list.length > 400 && <div className="small muted" style={{ marginTop: 8 }}>Se muestran los primeros 400. Usá el buscador para encontrar el resto.</div>}
        <div className="small muted" style={{ marginTop: 8 }}>* Mínimo por defecto. Podés definir uno propio para cada producto.</div>
      </div>

      {modal?.kind === 'scan' && <ScannerModal onClose={() => setModal(null)} onCode={onScan} />}
      {modal?.kind === 'new' && <ProductFormModal loc={api.loc} initialBarcode={modal.code} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <ProductFormModal loc={api.loc} product={data.products.find((p) => p.id === modal.id)} onClose={() => setModal(null)} />}
      {modal?.kind === 'view' && <ProductPanel id={modal.id} loc={api.loc} onClose={() => setModal(null)} onEdit={() => setModal({ kind: 'edit', id: modal.id })} />}
    </>
  );
};

const ProductPanel: React.FC<{ id: string; loc: Loc; onClose: () => void; onEdit: () => void }> = ({ id, loc, onClose, onEdit }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const p = data.products.find((x) => x.id === id);
  const [from, setFrom] = useState<Loc>(loc);
  const [tq, setTq] = useState('');
  const [aLoc, setALoc] = useState<Loc>(loc);
  const [aOp, setAOp] = useState<'sub' | 'add' | 'set'>('sub');
  const [aq, setAq] = useState('');
  const [why, setWhy] = useState('');
  if (!p) return null;
  const hist = data.purchaseItems.filter((i) => i.productId === id && i.status !== "CANCELLED").sort((a, b) => a.id.localeCompare(b.id)).slice(-5).reverse();
  return (
    <Modal title={p.name} onClose={onClose} wide
      footer={<><button className="ds-btn danger" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => run(() => archiveProduct(p), () => 'Producto archivado. Su historial se conserva.').then((r) => { if (r) onClose(); })}>Archivar</button><button className="ds-btn pri" onClick={onEdit}>Editar datos y precio</button></>}>
      <div className="ds-grid g3">
        <div className="ds-kpi"><span className="ds-label">Precio</span><span className="v num">{p.price ? money(p.price) : 'Sin precio'}</span><span className="s">Costo {p.cost ? money(p.cost) : '—'}</span></div>
        {LOC_IDS.map((l) => <div key={l} className="ds-kpi"><span className="ds-label"><span className={'ds-dot d-' + l} />{LOCS[l]}</span><span className="v num">{p.stock[l]}</span><span className="s">Mínimo {p.min}</span></div>)}
      </div>
      <div className="small muted num">Código {p.barcode}{p.lastSupplierName ? ' · Último proveedor: ' + p.lastSupplierName : ''}</div>
      {hist.length > 0 && (
        <div className="ds-tbl"><table><thead><tr><th>Últimos ingresos</th><th className="r">Cant.</th><th className="r">Costo</th><th className="r">Antes</th><th className="r">Precio</th></tr></thead>
          <tbody>{hist.map((h) => <tr key={h.id}><td className="muted small">{h.margin ? 'Margen ' + h.margin + '%' : ''}</td><td className="r num">{h.qty}</td><td className="r num">{money(h.unitCost)}</td><td className={'r num ' + (h.previousCost && h.unitCost > h.previousCost ? 'down' : 'muted')}>{h.previousCost ? money(h.previousCost) : '—'}</td><td className="r num">{money(h.finalSalePrice)}</td></tr>)}</tbody></table></div>
      )}
      <details>
        <summary>Pasar stock a la otra sucursal</summary>
        <div className="ds-row" style={{ marginTop: 8 }}>
          <select id="tr-from" value={from} onChange={(e) => setFrom(e.target.value as Loc)} style={{ maxWidth: 230 }}>
            {LOC_IDS.map((l) => <option key={l} value={l}>De {LOCS[l]} a {LOCS[otherLoc(l)]}</option>)}
          </select>
          <AmountInput id="tr-qty" value={tq} onChange={setTq} placeholder="Cantidad" className="ds-w110" />
          <button className="ds-btn sm" disabled={busy} onClick={() => run(() => transferStock(p, from, Math.round(parseAmount(tq))), () => `Pasaste ${Math.round(parseAmount(tq))} de ${LOCS[from]} a ${LOCS[otherLoc(from)]}.`).then((r) => { if (r) setTq(''); })}>Pasar</button>
        </div>
      </details>
      <details>
        <summary className="muted">Ajuste manual de stock (excepción)</summary>
        <div className="ds-col" style={{ marginTop: 8 }}>
          <div className="ds-row">
            <select id="adj-loc" value={aLoc} onChange={(e) => setALoc(e.target.value as Loc)} style={{ maxWidth: 160 }}>{LOC_IDS.map((l) => <option key={l} value={l}>{LOCS[l]}</option>)}</select>
            <select id="adj-op" value={aOp} onChange={(e) => setAOp(e.target.value as any)} style={{ maxWidth: 150 }}><option value="sub">Restar</option><option value="add">Sumar</option><option value="set">Dejar en</option></select>
            <AmountInput id="adj-qty" value={aq} onChange={setAq} placeholder="Cantidad" className="ds-w110" />
          </div>
          <div className="ds-chips">{['Vencido', 'Rotura', 'Conteo', 'Consumo propio', 'Otro'].map((w) => <button key={w} className={'ds-chip ' + (why === w ? 'on' : '')} onClick={() => setWhy(w)}>{w}</button>)}</div>
          <button className="ds-btn sm" style={{ alignSelf: 'flex-start' }} disabled={busy}
            onClick={() => run(() => adjustStock(p, aLoc, aOp, aq === '' ? NaN : Math.round(parseAmount(aq)), why), (r) => `${p.name} en ${LOCS[aLoc]}: ${r.before} → ${r.after} (${why}).`).then((r) => { if (r) { setAq(''); setWhy(''); } })}>Aplicar ajuste</button>
        </div>
      </details>
    </Modal>
  );
};
