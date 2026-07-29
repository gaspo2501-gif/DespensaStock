import React from 'react';
import { ShoppingBasket, Download, WifiOff, Sparkles } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export const Navbar: React.FC = () => {
  const { isInstallable, isOnline, promptInstall } = usePWA();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md text-slate-900 border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20 text-white">
            <ShoppingBasket className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Despensa Stock
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                v1.0.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium -mt-0.5">Control de Productos & Escáner</p>
          </div>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Modo Offline</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-semibold">
              <span className="status-dot"></span>
              <span>Sincronizado</span>
            </div>
          )}

          {isInstallable && (
            <button
              onClick={promptInstall}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Instalar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
