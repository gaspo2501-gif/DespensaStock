import React, { useState } from 'react';
import { LOCS } from '../core/model';
import { fdate, money } from '../core/calc';
import { useData } from '../data/DataContext';
import { cancelSale } from '../data/ops';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { Modal, PayPills, useRun } from './common';

export const SaleDetailModal: React.FC<{ saleId: string; onClose: () => void }> = ({ saleId, onClose }) => {
  const { data } = useData();
  const { run, busy } = useRun();
  const [reason, setReason] = useState('');
  const s = data.sales.find((x) => x.id === saleId);
  if (!s) return <Modal title="Venta" onClose={onClose}><div className="ds-empty">La venta todavía se está guardando.</div></Modal>;
  const cancelled = s.status === 'CANCELLED';
  return (
    <Modal title={'Venta del ' + fdate(s.date) + (s.time ? ' · ' + s.time : '')} onClose={onClose} wide>
      <div className="ds-row" style={{ gap: 6 }}>
        <span className={'ds-pill p-' + s.loc}>{LOCS[s.loc]}</span>
        {cancelled && <span className="ds-pill p-neu">Anulada{s.cancellationReason ? ': ' + s.cancellationReason : ''}</span>}
      </div>
      <div className="ds-tbl">
        <table>
          <thead><tr><th>Producto</th><th className="r">Cant.</th><th className="r">Precio</th><th className="r">Subtotal</th></tr></thead>
          <tbody>
            {s.items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="r num">{i.qty}</td><td className="r num">{money(i.unitPrice)}</td><td className="r num">{money(i.subtotal)}</td></tr>)}
            <tr><td colSpan={3}><b>Total</b></td><td className="r num"><b>{money(s.total)}</b></td></tr>
          </tbody>
        </table>
      </div>
      <PayPills pay={s.pay} />
      {s.customerName && s.pay.credit > 0 && <div className="small">Fiado a nombre de <b>{s.customerName}</b></div>}
      {!cancelled && (
        <details>
          <summary>Anular esta venta</summary>
          <div className="ds-col" style={{ marginTop: 8 }}>
            <label className="ds-field"><span>Motivo</span><input id="cs-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: se cobró dos veces" /></label>
            <div className="small muted">Se devuelve el stock a {LOCS[s.loc]}{s.pay.credit > 0 ? ' y se descuenta el fiado del cliente' : ''}. La plata sale de la caja del día.</div>
            <button className="ds-btn danger" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => run(() => cancelSale(s.id, reason), () => 'Venta anulada. Se devolvió el stock.').then((r) => { if (r !== undefined) onClose(); })}>Anular venta</button>
          </div>
        </details>
      )}
    </Modal>
  );
};

export const ScannerModal: React.FC<{ onClose: () => void; onCode: (c: string) => void }> = ({ onClose, onCode }) => (
  <Modal title="Escanear con la cámara" onClose={onClose}>
    <BarcodeScanner isScanningActive={true} onScanSuccess={(c) => { onClose(); onCode(c); }} />
  </Modal>
);
