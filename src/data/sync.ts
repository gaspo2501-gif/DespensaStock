/**
 * Estado de conexión y de operaciones pendientes de subir.
 * Con la caché persistente de Firestore, lo que se guarda sin internet queda en el equipo
 * y se sube solo cuando vuelve la conexión.
 */
export interface SyncState { online: boolean; pending: number }

let state: SyncState = { online: typeof navigator === 'undefined' ? true : navigator.onLine !== false, pending: 0 };
const subs = new Set<(s: SyncState) => void>();
const emit = () => subs.forEach((f) => f({ ...state }));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { state = { ...state, online: true }; emit(); });
  window.addEventListener('offline', () => { state = { ...state, online: false }; emit(); });
}

export const getSyncState = () => ({ ...state });
export function subscribeSync(f: (s: SyncState) => void) { subs.add(f); f({ ...state }); return () => { subs.delete(f); }; }
export const isOnline = () => state.online;

/**
 * Ejecuta una escritura. Con conexión espera la confirmación del servidor (y propaga errores).
 * Sin conexión no espera: Firestore la guarda en el equipo y la sube después.
 */
export async function runWrite(commit: () => Promise<unknown>): Promise<'saved' | 'queued'> {
  const track = (p: Promise<unknown>) => {
    state = { ...state, pending: state.pending + 1 }; emit();
    p.catch((e) => console.error('Error al subir una operación guardada sin conexión', e))
      .finally(() => { state = { ...state, pending: Math.max(0, state.pending - 1) }; emit(); });
  };
  const p = commit();
  if (!state.online) { track(p); return 'queued'; }
  // Con "internet" pero sin respuesta del servidor (conexión mala): no dejar la pantalla trabada.
  let timer: any;
  const timeout = new Promise<'timeout'>((r) => { timer = setTimeout(() => r('timeout'), 8000); });
  const res = await Promise.race([p.then(() => 'ok' as const), timeout]);
  clearTimeout(timer);
  if (res === 'timeout') { track(p); return 'queued'; }
  return 'saved';
}
