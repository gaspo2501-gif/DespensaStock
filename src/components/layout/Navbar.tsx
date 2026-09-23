import React from 'react';
import { ShoppingBasket, Download, WifiOff, RefreshCw } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import { LocationSelector } from '../common/LocationSelector';

export const Navbar: React.FC = () => {
  const { isInstallable, isOnline, promptInstall, hasUpdate, updateApp, dismissUpdate } = usePWA();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md text-slate-900 border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20 text-white shrink-0">
            <ShoppingBasket className="w-5 h-5" />
          </div>
          <div className="hidden min-[400px]:block">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                Despensa Stock
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                v1.1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium -mt-0.5 hidden md:block">Gestión Multilocal & Puntos de Venta</p>
          </div>
        </div>

        {/* Center Location Selector */}
        <div className="flex-1 flex justify-center max-w-xs mx-1">
          <LocationSelector />
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

          {/* Update Available Quick Button */}
          {hasUpdate && (
            <button
              onClick={updateApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all animate-pulse"
              title="Actualizar a la última versión disponible"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Actualizar app</span>
            </button>
          )}

          {isInstallable && (
            <button
              onClick={promptInstall}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Instalar</span>
            </button>
          )}
        </div>
      </div>

      {/* Discrete update notification banner */}
      {hasUpdate && (
        <div className="bg-slate-900 text-white px-4 py-2 text-xs flex items-center justify-between gap-3 shadow-inner border-t border-slate-800 animate-fadeIn">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hay una nueva versión disponible de Despensa Stock.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={updateApp}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
            >
              Actualizar
            </button>
            <button
              onClick={dismissUpdate}
              className="text-slate-400 hover:text-slate-200 text-xs font-medium"
            >
              Más tarde
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
