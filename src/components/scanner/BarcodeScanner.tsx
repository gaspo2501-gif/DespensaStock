import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, AlertTriangle, Flashlight, Keyboard, CheckCircle2, ShieldAlert } from 'lucide-react';
import { playScanSound } from '../../utils/audio';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  isScanningActive: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  isScanningActive,
}) => {
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'no_camera'>('prompt');
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-scanner-viewport';

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
      }
    }
  }, []);

  const handleBarcodeDetected = useCallback((decodedText: string) => {
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    // Avoid duplicate immediate re-scans
    if (lastScannedCode === cleanCode) return;

    setLastScannedCode(cleanCode);
    playScanSound('found');
    
    // Pause scanner briefly
    stopScanner();

    // Trigger parent success handler
    onScanSuccess(cleanCode);
  }, [lastScannedCode, stopScanner, onScanSuccess]);

  const startScanner = useCallback(async () => {
    setIsInitializing(true);
    setErrorMessage(null);
    await stopScanner();

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setPermissionState('no_camera');
        setIsInitializing(false);
        return;
      }

      setPermissionState('granted');

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
      ];

      const html5Qrcode = new Html5Qrcode(containerId, {
        formatsToSupport,
        verbose: false,
      });

      scannerRef.current = html5Qrcode;

      // Prefer rear camera ("environment")
      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.333333,
      };

      await html5Qrcode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {
          // Frame decode miss - normal during scanning
        }
      );
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      const errorStr = String(err);
      if (errorStr.includes('NotAllowedError') || errorStr.includes('Permission denied')) {
        setPermissionState('denied');
        setErrorMessage('Permiso de cámara denegado. Por favor, habilita el acceso a la cámara en el navegador.');
      } else {
        setErrorMessage('No se pudo acceder a la cámara trasera. Asegúrate de estar usando un dispositivo con cámara o intenta la carga manual.');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [stopScanner, handleBarcodeDetected]);

  useEffect(() => {
    if (isScanningActive && !showManualInput) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isScanningActive, showManualInput, startScanner, stopScanner]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !scannerRef.current.isScanning) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as unknown as MediaTrackConstraintSet]
      });
      setTorchOn(nextTorch);
    } catch {
      console.warn('Flashlight/Torch unsupported on this device.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playScanSound('found');
      onScanSuccess(manualCode.trim());
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Header bar */}
      <div className="px-4 py-3 bg-slate-950/80 backdrop-blur-md flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Escáner Activo
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
              showManualInput 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            {showManualInput ? 'Usar Cámara' : 'Ingreso Manual'}
          </button>

          {!showManualInput && permissionState === 'granted' && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full transition-colors ${
                torchOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Linterna"
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative min-h-[320px] bg-black flex flex-col items-center justify-center overflow-hidden">
        {showManualInput ? (
          /* Manual Barcode Input Mode */
          <div className="w-full p-6 text-slate-200 animate-fadeIn">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Keyboard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Ingresar Código de Barras</h3>
              <p className="text-xs text-slate-400 mt-1">Escribe el número completo que figura debajo de las barras del producto.</p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Número EAN-13 / UPC / Código:
                </label>
                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ej: 7791234567890"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-xl font-mono tracking-widest text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Buscar Código
              </button>
            </form>
          </div>
        ) : (
          /* Camera Viewport Mode */
          <>
            <div id={containerId} className="w-full h-[320px] object-cover" />

            {/* Custom Overlay Framing guide */}
            {permissionState === 'granted' && !isInitializing && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="relative w-64 h-40 border-2 border-dashed border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center overflow-hidden">
                  {/* Laser Scanning Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-[bounce_2s_infinite]" />
                  
                  {/* Corner Targets */}
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
                </div>
                <p className="mt-4 text-xs font-medium text-slate-300 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                  Apunta la cámara al código EAN / UPC
                </p>
              </div>
            )}

            {/* Initializing Loading State */}
            {isInitializing && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                <p className="text-sm font-semibold text-slate-200">Iniciando cámara trasera...</p>
                <p className="text-xs text-slate-400 mt-1">Por favor concede los permisos solicitados</p>
              </div>
            )}

            {/* Permission Denied / Error Overlay */}
            {(permissionState === 'denied' || permissionState === 'no_camera' || errorMessage) && !isInitializing && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Acceso a Cámara no disponible</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    {errorMessage || 'Se requiere permiso de cámara para escanear productos directamente.'}
                  </p>
                </div>

                <div className="flex flex-col w-full gap-2 pt-2">
                  <button
                    onClick={startScanner}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reintentar Cámara
                  </button>

                  <button
                    onClick={() => setShowManualInput(true)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md"
                  >
                    <Keyboard className="w-4 h-4" />
                    Cargar Código Manualmente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2.5 bg-slate-950 text-center border-t border-slate-800/80">
        <p className="text-[11px] text-slate-400">
          Soporta códigos EAN-13, EAN-8, UPC-A, UPC-E y Code-128
        </p>
      </div>
    </div>
  );
};
