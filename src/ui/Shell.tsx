import React, { useEffect, useState } from 'react';
import { Loc, LOCS, LOC_IDS } from '../core/model';
import { useData } from '../data/DataContext';
import { Icon, Modal, ToastProvider, useRun } from './common';
import { downloadBackup } from '../data/backup';
import { usePWA } from '../hooks/usePWA';
import { InicioView } from './views/InicioView';
import { VentaView } from './views/VentaView';
import { ClientesView } from './views/ClientesView';
import { StockView } from './views/StockView';
import { ComprasView } from './views/ComprasView';
import { ProveedoresView } from './views/ProveedoresView';
import { CajaView } from './views/CajaView';
import { ReportesView } from './views/ReportesView';

export type View = 'inicio' | 'venta' | 'clientes' | 'stock' | 'compras' | 'proveedores' | 'caja' | 'reportes';
const NAV: [View, string, string?][] = [
  ['inicio', 'Inicio'], ['venta', 'Venta', 'F1'], ['clientes', 'Clientes y fiado'], ['stock', 'Stock'],
  ['compras', 'Ingreso de mercadería'], ['proveedores', 'Proveedores'], ['caja', 'Caja'], ['reportes', 'Reportes'],
];
const BOTTOM: View[] = ['inicio', 'venta', 'stock', 'caja'];
const LOC_KEY = 'despensa_stock_active_location_id';

function loadLoc(): Loc {
  try { const v = localStorage.getItem(LOC_KEY); if (v === 'olascoaga') return 'olascoaga'; } catch { /* sin acceso */ }
  return 'aimogasta';
}

export interface ShellApi { loc: Loc; go: (v: View) => void }

export const Shell: React.FC = () => (
  <ToastProvider><ShellInner /></ToastProvider>
);

const ShellInner: React.FC = () => {
  const { loaded, error, sync } = useData();
  const pwa = usePWA();
  const { run: runBackup, busy: backingUp } = useRun();
  const backup = () => runBackup(() => downloadBackup(), (n) => 'Copia de seguridad descargada (' + n + ' registros).');
  const [view, setView] = useState<View>('inicio');
  const [loc, setLocState] = useState<Loc>(loadLoc);
  const [more, setMore] = useState(false);
  const [busyLoc, setBusyLoc] = useState(false);

  const setLoc = (l: Loc) => { setLocState(l); try { localStorage.setItem(LOC_KEY, l); } catch { /* sin acceso */ } };
  const go = (v: View) => { setView(v); setMore(false); window.scrollTo(0, 0); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'F1') { e.preventDefault(); go('venta'); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const api: ShellApi = { loc, go };
  const status = !sync.online
    ? <span className="ds-pill p-warn">Sin conexión · {sync.pending} {sync.pending === 1 ? 'operación pendiente' : 'operaciones pendientes'} de subir</span>
    : sync.pending > 0 ? <span className="ds-pill p-mp">Subiendo {sync.pending}…</span>
    : <span className="ds-pill p-ok">En línea · todo guardado</span>;

  return (
    <div className="ds-root">
      <div className="ds-app">
        <aside className="ds-side">
          <div className="ds-brand"><div className="ds-brand-mark">D</div><div><b>DespensaStock</b><span className="small muted">Gestión de despensa</span></div></div>
          <nav className="ds-nav">
            {NAV.map(([k, l, kb]) => (
              <button key={k} className={view === k ? 'on' : ''} onClick={() => go(k)}><Icon name={k} /><span>{l}</span>{kb && <span className="ds-kbd">{kb}</span>}</button>
            ))}
          </nav>
          <div className="ds-col" style={{ marginTop: 'auto', gap: 8 }}>
            {pwa.isInstallable && <button className="ds-btn sm" onClick={pwa.promptInstall}>Instalar aplicación</button>}
            <button className="ds-btn sm ghost" disabled={backingUp} onClick={backup}>{backingUp ? 'Descargando…' : 'Descargar copia de seguridad'}</button>
          </div>
        </aside>
        <div className="ds-main">
          <header className="ds-top">
            <div>
              <div className="ds-label">Sucursal donde estás trabajando</div>
              <div className="ds-seg" style={{ marginTop: 4 }}>
                {LOC_IDS.map((l) => (
                  <button key={l} className={loc === l ? 'on' : ''} disabled={busyLoc} onClick={() => setLoc(l)}><span className={'ds-dot d-' + l} />{LOCS[l]}</button>
                ))}
              </div>
            </div>
            <div className="ds-status">
              {pwa.hasUpdate && <button className="ds-btn sm pri" onClick={pwa.updateApp}>Actualizar app</button>}
              {status}
            </div>
          </header>
          <main className="ds-view">
            {error && <div className="ds-panel" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{error}</div>}
            {!loaded ? (
              <div className="ds-empty">Cargando tus datos…</div>
            ) : (
              <>
                {view === 'inicio' && <InicioView api={api} />}
                {view === 'venta' && <VentaView api={api} setLocLocked={setBusyLoc} />}
                {view === 'clientes' && <ClientesView api={api} />}
                {view === 'stock' && <StockView api={api} />}
                {view === 'compras' && <ComprasView api={api} />}
                {view === 'proveedores' && <ProveedoresView api={api} />}
                {view === 'caja' && <CajaView api={api} />}
                {view === 'reportes' && <ReportesView api={api} />}
              </>
            )}
          </main>
        </div>
      </div>
      <nav className="ds-bottom">
        {BOTTOM.map((k) => (
          <button key={k} className={view === k ? 'on' : ''} onClick={() => go(k)}><Icon name={k} size={22} /><span>{NAV.find((n) => n[0] === k)![1]}</span></button>
        ))}
        <button className={!BOTTOM.includes(view) ? 'on' : ''} onClick={() => setMore(true)}><Icon name="mas" size={22} /><span>Más</span></button>
      </nav>
      {more && (
        <Modal title="Más secciones" onClose={() => setMore(false)}>
          <div className="ds-list">
            {(['clientes', 'compras', 'proveedores', 'reportes'] as View[]).map((k) => (
              <button key={k} className="ds-btn" style={{ justifyContent: 'flex-start' }} onClick={() => go(k)}><Icon name={k} size={20} />{NAV.find((n) => n[0] === k)![1]}</button>
            ))}
            <button className="ds-btn ghost" disabled={backingUp} onClick={backup}>Descargar copia de seguridad</button>
          </div>
        </Modal>
      )}
    </div>
  );
};
