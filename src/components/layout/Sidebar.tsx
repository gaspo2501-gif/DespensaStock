import React from 'react';
import { NavigationTab } from '../../types/product';
import { 
  ShoppingBasket, 
  Home, 
  ShoppingCart, 
  Boxes, 
  Users, 
  Wallet, 
  BarChart3, 
  WifiOff, 
  Download 
} from 'lucide-react';
import { LocationSelector } from '../common/LocationSelector';
import { usePWA } from '../../hooks/usePWA';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'sales', label: 'Venta', icon: ShoppingCart },
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'cash', label: 'Caja', icon: Wallet },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { isInstallable, isOnline, promptInstall } = usePWA();

  // Normalize legacy or sub-tabs for active styling
  const getActiveTab = (): NavigationTab => {
    if (currentTab === 'list' || currentTab === 'search' || currentTab === 'scan') return 'stock';
    if (currentTab === 'expenses') return 'cash';
    return currentTab;
  };

  const activeTab = getActiveTab();

  return (
    <aside className="w-60 bg-white border-r border-slate-200/90 h-screen sticky top-0 flex flex-col justify-between p-4 shadow-xs select-none shrink-0 z-30">
      {/* Top Section: Brand + Branch Selector */}
      <div className="space-y-4">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20 text-white shrink-0">
            <ShoppingBasket className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base text-slate-900 tracking-tight truncate">
                Despensa Stock
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                v1.1.0
              </span>
              <span className="text-[11px] text-slate-400 font-medium">POS</span>
            </div>
          </div>
        </div>

        {/* Active Branch Selector Widget */}
        <div className="pt-1 pb-2 border-b border-slate-100">
          <LocationSelector />
        </div>

        {/* Main Navigation Items (6 Core Areas) */}
        <nav className="space-y-1 pt-1">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Módulos Principales
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'stroke-[2.5]' : 'text-slate-400'}`} />
                <span className="tracking-tight text-[13px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Sync Status & PWA Install */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        {/* Sync Indicator */}
        <div className="px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Conexión:</span>
          {!isOnline ? (
            <span className="flex items-center gap-1.5 text-amber-700 font-bold">
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              Offline
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sincronizado
            </span>
          )}
        </div>

        {/* Install Button if PWA prompt is available */}
        {isInstallable && (
          <button
            onClick={promptInstall}
            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Instalar Aplicación</span>
          </button>
        )}
      </div>
    </aside>
  );
};
