import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_MIN_STOCK, Loc, LOCS, Product } from '../core/model';
import { parseAmount } from '../core/calc';
import { useData } from '../data/DataContext';
import { saveNewProduct, updateProduct, ProductInput } from '../data/ops';
import { getProductByBarcodeExternal } from '../services/externalApi/productApiService';
import { PRODUCT_CATEGORIES } from '../utils/categories';
import { AmountInput, Modal, useRun } from './common';

const CATS = PRODUCT_CATEGORIES.map((c) => c.name);

/**
 * Alta y edición de producto. En el alta, al ingresar un código nuevo busca los datos en
 * Open Food Facts y completa el formulario para revisar antes de guardar (no guarda solo).
 */
export const ProductFormModal: React.FC<{
  product?: Product; loc: Loc; initialBarcode?: string; onClose: () => void; onSaved?: (id: string) => void; hideStock?: boolean;
}> = ({ product, loc, initialBarcode, onClose, onSaved, hideStock }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [f, setF] = useState({
    name: product?.name || '', barcode: product?.barcode || initialBarcode || '', category: product?.category || 'Almacén',
    brand: product?.brand || '', presentation: product?.presentation || '', price: product?.price ? String(product.price) : '',
    min: String(product && !product.minIsDefault ? product.min : DEFAULT_MIN_STOCK), stock: '0', imageUrl: product?.imageUrl || '', description: product?.description || '',
  });
  const [lookup, setLookup] = useState<'' | 'searching' | 'found' | 'notfound'>('');
  const lastLooked = useRef('');
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const doLookup = async (code: string) => {
    const c = code.trim();
    if (product || !/^\d{6,14}$/.test(c) || lastLooked.current === c) return;
    lastLooked.current = c;
    setLookup('searching');
    try {
      const r = await getProductByBarcodeExternal(c);
      if (r.found && r.product) {
        const x = r.product;
        setF((p) => ({
          ...p, name: p.name || x.name, brand: p.brand || x.brand, presentation: p.presentation || x.presentation,
          category: CATS.includes(x.category) ? x.category : p.category, imageUrl: p.imageUrl || x.imageUrl || '', description: p.description || x.description,
        }));
        setLookup('found');
      } else setLookup('notfound');
    } catch { setLookup('notfound'); }
  };
  useEffect(() => { if (initialBarcode) doLookup(initialBarcode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => run(async () => {
    const input: ProductInput = {
      name: f.name, barcode: f.barcode, category: f.category, brand: f.brand, presentation: f.presentation, description: f.description,
      imageUrl: f.imageUrl, price: parseAmount(f.price) || undefined, min: Math.max(0, Math.round(parseAmount(f.min))),
      initialStock: hideStock ? 0 : Math.max(0, Math.round(parseAmount(f.stock))), source: lookup === 'found' ? 'external_api' : 'manual',
    };
    if (product) { await updateProduct(product, input, data.products); return product.id; }
    return saveNewProduct(input, loc, data.products);
  }, () => (product ? 'Producto actualizado.' : 'Producto creado.')).then((id) => { if (id) { onSaved?.(id); onClose(); } });

  return (
    <Modal title={product ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} wide
      footer={<><button className="ds-btn" onClick={onClose}>Cancelar</button><button className="ds-btn pri" disabled={busy} onClick={save}>Guardar</button></>}>
      <div className="ds-grid g2">
        <label className="ds-field"><span>Código de barras</span>
          <input id="pf-code" type="text" inputMode="numeric" className="num" value={f.barcode} autoFocus={!product && !initialBarcode}
            onChange={(e) => set('barcode')(e.target.value)} onBlur={(e) => doLookup(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doLookup((e.target as HTMLInputElement).value); } }} />
          {lookup === 'searching' && <span className="small muted">Buscando datos del producto…</span>}
          {lookup === 'found' && <span className="small" style={{ color: 'var(--cash)' }}>Datos completados desde Open Food Facts. Revisalos antes de guardar.</span>}
          {lookup === 'notfound' && <span className="small muted">No se encontró en la base pública. Cargalo a mano.</span>}
        </label>
        <label className="ds-field"><span>Nombre</span><input id="pf-name" type="text" value={f.name} autoFocus={!!initialBarcode} onChange={(e) => set('name')(e.target.value)} /></label>
        <label className="ds-field"><span>Marca</span><input id="pf-brand" type="text" value={f.brand} onChange={(e) => set('brand')(e.target.value)} /></label>
        <label className="ds-field"><span>Presentación</span><input id="pf-pres" type="text" value={f.presentation} placeholder="Ej: 1 kg" onChange={(e) => set('presentation')(e.target.value)} /></label>
        <label className="ds-field"><span>Categoría</span>
          <select id="pf-cat" value={f.category} onChange={(e) => set('category')(e.target.value)}>
            {[...new Set([...CATS, f.category])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="ds-field"><span>Precio de venta</span><AmountInput id="pf-price" value={f.price} onChange={set('price')} placeholder="Se calcula al ingresar mercadería" /></label>
        <label className="ds-field"><span>Stock mínimo (avisa en cada sucursal)</span><AmountInput id="pf-min" value={f.min} onChange={set('min')} /></label>
        {product ? (
          <div className="ds-field"><span>Stock actual</span><div className="num" style={{ paddingTop: 8 }}>{LOCS.aimogasta}: <b>{product.stock.aimogasta}</b> · {LOCS.olascoaga}: <b>{product.stock.olascoaga}</b></div></div>
        ) : !hideStock ? (
          <label className="ds-field"><span>Stock inicial en {LOCS[loc]}</span><AmountInput id="pf-stock" value={f.stock} onChange={set('stock')} /></label>
        ) : <div className="ds-note">El stock entra con este ingreso de mercadería.</div>}
      </div>
    </Modal>
  );
};
