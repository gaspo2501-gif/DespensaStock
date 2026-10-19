import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LOCS, Pay, Product } from '../../core/model';
import { balances, money, parseAmount, payFromParts, payTotal, today } from '../../core/calc';
import { useData } from '../../data/DataContext';
import { createCustomer, createSale, UserError } from '../../data/ops';
import { playScanSound } from '../../utils/audio';
import { AmountInput, Icon, LocName, Modal, PayPills, useRun, useToast } from '../common';
import { ProductFormModal } from '../ProductForm';
import { SaleDetailModal, ScannerModal } from '../SaleDetail';
import type { ShellApi } from '../Shell';

type PayMode = 'cash' | 'mp' | 'credit' | 'mixed' | 'transfer';
interface Line { pid: string; qty: number; price: number; savePrice: boolean }

export const VentaView: React.FC<{ api: ShellApi; setLocLocked: (b: boolean) => void }> = ({ api, setLocLocked }) => {
  const { data, sync } = useData();
  const toast = useToast();
  const { run, busy } = useRun();
  const loc = api.loc;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(-1);
  const [cart, setCart] = useState<Line[]>([]);
  const [mode, setMode] = useState<PayMode>('cash');
  const [showTransfer, setShowTransfer] = useState(false);
  const [payWith, setPayWith] = useState('');
  const [split, setSplit] = useState({ mp: '', cash: '', credit: '', transfer: '' });
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [custQ, setCustQ] = useState('');
  const [err, setErr] = useState('');
  const [modal, setModal] = useState<null | { kind: 'scan' } | { kind: 'today' } | { kind: 'sale'; id: string } | { kind: 'newProduct'; code: string } | { kind: 'newCust' }>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);

  const byId = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const bal = useMemo(() => balances(data), [data]);
  useEffect(() => { setLocLocked(cart.length > 0); return () => setLocLocked(false); }, [cart.length, setLocLocked]);
  useEffect(() => { if (!modal) searchRef.current?.focus(); }, [modal]);
  useEffect(() => {
    if (!pendingAdd) return;
    const p = byId.get(pendingAdd);
    if (p) { setPendingAdd(null); add(p); }
  }, [pendingAdd, byId]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return data.products.filter((p) => !p.archived && (p.name.toLowerCase().includes(s) || p.barcode.includes(s) || p.brand.toLowerCase().includes(s) || p.category.toLowerCase().includes(s))).slice(0, 8);
  }, [q, data.products]);

  const total = cart.reduce((t, l) => t + l.qty * l.price, 0);
  const pay: Pay = useMemo(() => {
    if (mode === 'cash') return payFromParts({ cash: total });
    if (mode === 'mp') return payFromParts({ mp: total });
    if (mode === 'credit') return payFromParts({ credit: total });
    if (mode === 'transfer') return payFromParts({ transfer: total });
    return payFromParts({ mp: parseAmount(split.mp), cash: parseAmount(split.cash), credit: parseAmount(split.credit), transfer: parseAmount(split.transfer) });
  }, [mode, total, split]);
  const needCustomer = pay.credit > 0;
  const customer = customerId ? data.customers.find((c) => c.id === customerId) : undefined;

  const add = (p: Product) => {
    setErr('');
    const cur = cart.find((l) => l.pid === p.id);
    const qty = (cur?.qty || 0) + 1;
    if (qty > p.stock[loc] && sync.online) {
      playScanSound('error');
      toast(`No hay más stock de “${p.name}” en ${LOCS[loc]} (quedan ${Math.max(0, p.stock[loc])}).`, 'warn');
      return;
    }
    playScanSound('success');
    setCart((c) => (c.some((l) => l.pid === p.id) ? c.map((l) => (l.pid === p.id ? { ...l, qty: l.qty + 1 } : l)) : [...c, { pid: p.id, qty: 1, price: p.price || 0, savePrice: false }]));
    if (!p.price) toast(`“${p.name}” no tiene precio cargado. Escribilo en el carrito.`, 'warn');
    setQ(''); setSel(-1);
    searchRef.current?.focus();
  };

  const handleCode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const exact = data.products.find((p) => !p.archived && p.barcode === code);
    if (exact) return add(exact);
    if (sel >= 0 && matches[sel]) return add(matches[sel]);
    if (/^\d{6,14}$/.test(code)) {
      playScanSound('error');
      setQ('');
      toast(`No hay ningún producto con el código ${code}.`, 'err', { label: 'Crear producto', fn: () => setModal({ kind: 'newProduct', code }) });
      return;
    }
    if (matches.length) { setSel(0); toast('Elegí el producto de la lista (flechas y Enter, o clic).', 'warn'); }
  };

  const setQty = (pid: string, qty: number) => {
    const p = byId.get(pid); if (!p) return;
    if (qty <= 0) return setCart((c) => c.filter((l) => l.pid !== pid));
    if (qty > p.stock[loc] && sync.online) { toast(`En ${LOCS[loc]} hay ${p.stock[loc]} de “${p.name}”.`, 'warn'); return; }
    setCart((c) => c.map((l) => (l.pid === pid ? { ...l, qty } : l)));
  };

  const reset = () => { setCart([]); setMode('cash'); setPayWith(''); setSplit({ mp: '', cash: '', credit: '', transfer: '' }); setCustomerId(null); setCustQ(''); setErr(''); };

  const confirm = () => {
    if (!cart.length || busy) return;
    const zero = cart.filter((l) => !(l.price > 0));
    if (zero.length) return setErr('Falta el precio de ' + zero.map((l) => '“' + byId.get(l.pid)?.name + '”').join(', ') + '. Escribilo en el carrito.');
    if (mode === 'mixed' && Math.abs(payTotal(pay) - total) >= 1) return setErr('Las partes del pago combinado tienen que sumar ' + money(total) + '.');
    if (needCustomer && !customer) return setErr('Elegí el cliente a cuyo nombre queda el fiado.');
    const change = mode === 'cash' && parseAmount(payWith) > total ? ' · Vuelto ' + money(parseAmount(payWith) - total) : '';
    run(() => createSale({
      lines: cart.map((l) => ({ product: byId.get(l.pid)!, qty: l.qty, unitPrice: l.price, savePrice: l.savePrice })),
      pay, customer: needCustomer ? customer : undefined, loc,
    })).then((r) => {
      if (!r) return;
      playScanSound('success');
      reset();
      toast('Venta registrada: ' + money(r.total) + change + (r.queued ? ' · guardada en este equipo, se sube al volver internet' : ''), '', { label: 'Ver comprobante', fn: () => setModal({ kind: 'sale', id: r.saleId }) });
    });
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'F2' && !modal) { e.preventDefault(); confirm(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const fillRest = (k: keyof typeof split) => {
    const others = (['mp', 'cash', 'credit', 'transfer'] as const).filter((x) => x !== k).reduce((t, x) => t + parseAmount(split[x]), 0);
    const rest = Math.max(0, total - others);
    setSplit((s) => ({ ...s, [k]: rest ? String(Math.round(rest * 100) / 100) : '' }));
  };

  const custList = useMemo(() => {
    const s = custQ.trim().toLowerCase();
    return data.customers.filter((c) => !s || c.name.toLowerCase().includes(s) || c.phone.includes(s)).slice(0, 30);
  }, [custQ, data.customers]);

  const PayBtn: React.FC<{ m: PayMode; label: string; sub: string }> = ({ m, label, sub }) => (
    <button className={'ds-paybtn ' + (mode === m ? 'on' : '')} data-m={m} onClick={() => { setMode(m); setErr(''); }}>{label}<small>{sub}</small></button>
  );
  const assigned = payTotal(pay);
  const todaySales = data.sales.filter((s) => s.date === today() && s.loc === loc).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <div className="ds-row spread">
        <div><h1>Venta</h1><div className="muted">Vendiendo en <LocName loc={loc} />{cart.length > 0 && <span className="small"> · para cambiar de sucursal terminá o vaciá la venta</span>}</div></div>
        <button className="ds-btn" onClick={() => setModal({ kind: 'today' })}>Ventas de hoy</button>
      </div>
      <div className="ds-pos">
        <div className="ds-panel">
          <div className="ds-row" style={{ alignItems: 'flex-end' }}>
            <label className="ds-field" style={{ flex: 1 }}>
              <span>Buscar o escanear producto</span>
              <input ref={searchRef} id="sale-q" className="big" type="search" autoComplete="off" placeholder="Nombre, marca, categoría o código de barras" value={q}
                onChange={(e) => { setQ(e.target.value); setSel(-1); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(matches.length - 1, s + 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(-1, s - 1)); }
                  else if (e.key === 'Enter') { e.preventDefault(); handleCode(q); }
                }} />
            </label>
            <button className="ds-btn" onClick={() => setModal({ kind: 'scan' })} title="Escanear con la cámara"><Icon name="scan" />Cámara</button>
          </div>
          {q.trim() && (matches.length ? (
            <div className="ds-results">
              {matches.map((p, i) => {
                const st = p.stock[loc];
                return (
                  <button key={p.id} className={i === sel ? 'sel' : ''} onClick={() => add(p)}>
                    <span style={{ flex: 1, minWidth: 0 }}><span className="trunc" style={{ display: 'block', fontWeight: 600 }}>{p.name}</span><span className="small muted num">{p.barcode} · {p.category}</span></span>
                    <span className={'ds-pill num ' + (st <= 0 ? 'p-bad' : st <= p.min ? 'p-warn' : 'p-neu')}>Stock {st}</span>
                    <b className="num">{p.price ? money(p.price) : <span className="ds-pill p-warn">Sin precio</span>}</b>
                  </button>
                );
              })}
            </div>
          ) : <div className="ds-note" style={{ marginTop: 8 }}>No hay productos que coincidan con “{q}”.</div>)}
          <div className="small muted" style={{ marginTop: 8 }}>Con lector de códigos: escaneá y se agrega solo si el código coincide exacto.</div>

          <div style={{ marginTop: 14 }}>
            {!cart.length ? <div className="ds-empty">El carrito está vacío. Buscá o escaneá un producto para empezar.</div> : (
              <>
                <div className="ds-row spread"><span className="ds-label">{cart.length} productos · {cart.reduce((t, l) => t + l.qty, 0)} unidades</span><button className="ds-btn ghost sm" onClick={reset}>Vaciar carrito</button></div>
                {cart.map((l) => {
                  const p = byId.get(l.pid);
                  if (!p) return null;
                  const over = p.stock[loc] < l.qty;
                  return (
                    <div className="ds-cart-line" key={l.pid}>
                      <div style={{ minWidth: 0 }}>
                        <div className="trunc" style={{ fontWeight: 600 }}>{p.name}</div>
                        <div className="small" style={{ color: over ? 'var(--warn)' : 'var(--muted)' }}>{over ? `Supera el stock (${p.stock[loc]}) · se registra igual sin conexión` : `Stock en ${LOCS[loc]}: ${p.stock[loc]}`}</div>
                        {!p.price && (
                          <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--warn)', marginTop: 4 }}>
                            <input type="checkbox" checked={l.savePrice} onChange={(e) => setCart((c) => c.map((x) => (x.pid === l.pid ? { ...x, savePrice: e.target.checked } : x)))} /> Guardar este precio en el producto
                          </label>
                        )}
                      </div>
                      <div className="ds-qty">
                        <button onClick={() => setQty(l.pid, l.qty - 1)} aria-label="Restar">−</button>
                        <input className="num" value={l.qty} aria-label="Cantidad" onChange={(e) => { const v = Math.round(parseAmount(e.target.value)); if (v > 0) setQty(l.pid, v); }} />
                        <button onClick={() => setQty(l.pid, l.qty + 1)} aria-label="Sumar">+</button>
                      </div>
                      <PriceInput value={l.price} missing={!p.price} onChange={(v) => setCart((c) => c.map((x) => (x.pid === l.pid ? { ...x, price: v } : x)))} />
                      <b className="num" style={{ minWidth: 84, textAlign: 'right' }}>{money(l.qty * l.price)}</b>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <div className="ds-panel">
          <div className="ds-label">Total a cobrar</div>
          <div className="ds-total num" style={{ margin: '4px 0 14px' }}>{money(total)}</div>
          <div className="ds-paybtns">
            <PayBtn m="cash" label="Efectivo" sub="Calcula el vuelto" />
            <PayBtn m="mp" label="Mercado Pago" sub="Entra a lo digital" />
            <PayBtn m="credit" label="Fiado" sub="A cuenta de un cliente" />
            <PayBtn m="mixed" label="Combinado" sub="MP + efectivo + fiado" />
          </div>
          <div style={{ marginTop: 6 }}>
            {mode === 'transfer' || showTransfer ? <div className="ds-paybtns" style={{ gridTemplateColumns: '1fr' }}><PayBtn m="transfer" label="Transferencia" sub="Banco" /></div>
              : <button className="ds-btn ghost sm" onClick={() => setShowTransfer(true)}>Otro medio: transferencia</button>}
          </div>
          <div className="ds-col" style={{ marginTop: 14 }}>
            {mode === 'cash' && (
              <>
                <label className="ds-field"><span>Paga con (opcional)</span><AmountInput id="pay-with" value={payWith} onChange={setPayWith} placeholder="Ej: 10000" /></label>
                {parseAmount(payWith) > 0 && (parseAmount(payWith) >= total
                  ? <div className="ds-cmp"><span>Vuelto</span><b className="num" style={{ fontSize: '1.3rem' }}>{money(parseAmount(payWith) - total)}</b></div>
                  : <div className="ds-note" style={{ color: 'var(--warn)' }}>Faltan {money(total - parseAmount(payWith))}</div>)}
              </>
            )}
            {mode === 'mixed' && (
              <>
                <div className="ds-split">
                  {([['mp', 'Mercado Pago'], ['cash', 'Efectivo'], ['credit', 'Fiado'], ...(showTransfer ? [['transfer', 'Transferencia']] : [])] as [keyof typeof split, string][]).map(([k, l]) => (
                    <React.Fragment key={k}>
                      <label htmlFor={'sp-' + k}>{l}</label>
                      <AmountInput id={'sp-' + k} value={split[k]} onChange={(v) => setSplit((s) => ({ ...s, [k]: v }))} placeholder="0" />
                      <button className="ds-btn sm" onClick={() => fillRest(k)} title="Completar con lo que falta">Resto</button>
                    </React.Fragment>
                  ))}
                </div>
                <div className="ds-cmp">
                  <span>Asignado</span><b className="num">{money(assigned)}</b>
                  <span>{total - assigned >= 0 ? 'Falta asignar' : 'Te pasaste por'}</span>
                  <b className={'num ' + (Math.abs(total - assigned) < 1 ? 'diff0' : 'diffx')}>{money(Math.abs(total - assigned))}</b>
                </div>
              </>
            )}
            {needCustomer && (customer ? (
              <div>
                <div className="ds-label" style={{ marginBottom: 6 }}>Fiado a nombre de</div>
                <div className="ds-chosen"><span>{customer.name}</span><button className="ds-btn ghost sm" onClick={() => setCustomerId(null)}>Cambiar</button></div>
                <div className="small muted" style={{ marginTop: 6 }}>Debe <b className="num">{money(bal[customer.id] || 0)}</b> · con esta venta quedará en <b className="num" style={{ color: 'var(--fiado)' }}>{money((bal[customer.id] || 0) + pay.credit)}</b></div>
              </div>
            ) : (
              <div>
                <label className="ds-field"><span>Cliente para el fiado (obligatorio)</span><input id="cust-q" type="search" autoComplete="off" placeholder="Escribí el nombre" value={custQ} onChange={(e) => setCustQ(e.target.value)} /></label>
                <div className="ds-cust-pick" style={{ marginTop: 6 }}>
                  {custList.map((c) => (
                    <button key={c.id} onClick={() => setCustomerId(c.id)}>
                      <span>{c.name}</span>
                      <span className={'num small ' + ((bal[c.id] || 0) > 0.5 ? '' : 'muted')} style={(bal[c.id] || 0) > 0.5 ? { color: 'var(--fiado)', fontWeight: 700 } : undefined}>{(bal[c.id] || 0) > 0.5 ? 'Debe ' + money(bal[c.id]) : 'Sin deuda'}</span>
                    </button>
                  ))}
                  <button onClick={() => setModal({ kind: 'newCust' })}><span style={{ color: 'var(--accent)', fontWeight: 700 }}>+ {custQ.trim() ? `Crear “${custQ.trim()}” como cliente nuevo` : 'Nuevo cliente'}</span><span /></button>
                </div>
              </div>
            ))}
          </div>
          {err && <div className="ds-note" style={{ marginTop: 12, color: 'var(--danger)', background: 'var(--danger-soft)' }}>{err}</div>}
          <button className="ds-btn pri ds-confirm" style={{ marginTop: 12 }} disabled={!cart.length || busy} onClick={confirm}>
            {busy ? 'Guardando…' : <>Cobrar {money(total)} <span className="ds-kbd" style={{ color: 'inherit', borderColor: 'currentColor' }}>F2</span></>}
          </button>
        </div>
      </div>

      {modal?.kind === 'scan' && <ScannerModal onClose={() => setModal(null)} onCode={handleCode} />}
      {modal?.kind === 'sale' && <SaleDetailModal saleId={modal.id} onClose={() => setModal(null)} />}
      {modal?.kind === 'newProduct' && (
        <ProductFormModal loc={loc} initialBarcode={modal.code} onClose={() => setModal(null)}
          onSaved={(id) => setPendingAdd(id)} />
      )}
      {modal?.kind === 'newCust' && <NewCustomerModal initial={custQ} onClose={() => setModal(null)} onCreated={(id) => { setCustomerId(id); setCustQ(''); }} />}
      {modal?.kind === 'today' && (
        <Modal title={'Ventas de hoy en ' + LOCS[loc]} onClose={() => setModal(null)} wide>
          {todaySales.length ? (
            <div className="ds-tbl"><table>
              <thead><tr><th>Hora</th><th>Productos</th><th>Pago</th><th className="r">Total</th></tr></thead>
              <tbody>{todaySales.map((s) => (
                <tr key={s.id} className={'click ' + (s.status === 'CANCELLED' ? 'cancel' : '')} onClick={() => setModal({ kind: 'sale', id: s.id })}>
                  <td className="num">{s.time}</td><td>{s.items.length} prod.</td><td><PayPills pay={s.pay} /></td><td className="r num">{money(s.total)}</td>
                </tr>))}
              </tbody></table></div>
          ) : <div className="ds-empty">Todavía no hay ventas hoy.</div>}
        </Modal>
      )}
    </>
  );
};

/** Precio editable en el carrito: se confirma al salir del campo o con Enter. */
const PriceInput: React.FC<{ value: number; missing: boolean; onChange: (v: number) => void }> = ({ value, missing, onChange }) => {
  const [v, setV] = useState(value ? String(value) : '');
  useEffect(() => { setV(value ? String(value) : ''); }, [value]);
  return (
    <input className={'ds-price-in num ' + (missing && !value ? 'noprice' : '')} inputMode="decimal" placeholder="Precio" aria-label="Precio unitario" value={v}
      onChange={(e) => setV(e.target.value)} onBlur={() => onChange(Math.max(0, parseAmount(v)))}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
};

export const NewCustomerModal: React.FC<{ initial?: string; onClose: () => void; onCreated?: (id: string) => void }> = ({ initial, onClose, onCreated }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [name, setName] = useState(initial || '');
  const [phone, setPhone] = useState('');
  const save = () => {
    if (data.customers.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())) return run(async () => { throw new UserError('Ya existe un cliente con ese nombre.'); });
    run(() => createCustomer(name, phone), (c) => `Cliente “${c.name}” creado.`).then((c) => { if (c) { onCreated?.(c.id); onClose(); } });
  };
  return (
    <Modal title="Nuevo cliente" onClose={onClose} footer={<><button className="ds-btn" onClick={onClose}>Cancelar</button><button className="ds-btn pri" disabled={busy} onClick={save}>Guardar cliente</button></>}>
      <label className="ds-field"><span>Nombre y apellido</span><input id="nc-name" type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} /></label>
      <label className="ds-field"><span>Teléfono (opcional)</span><input id="nc-phone" type="text" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
    </Modal>
  );
};
