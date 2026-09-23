import React from 'react';
import { NavigationTab } from '../../types/product';
import { Home, Users, ShoppingCart, Boxes, Wallet, BarChart3 } from 'lucide-react';

interface BottomNavProps {
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

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  // Normalize legacy/internal sub-tabs
  const getActiveTab = (): NavigationTab => {
    if (currentTab === 'list' || currentTab === 'search' || currentTab === 'scan') return 'stock';
    if (currentTab === 'expenses') return 'cash';
    return currentTab;
  };

  const activeTab = getActiveTab();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 safe-area-pb">
      <div className="max-w-md mx-auto grid grid-cols-6 items-center text-center">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-all py-1 px-0.5 rounded-xl ${
                isActive
                  ? 'text-emerald-700 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${
                isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'
              }`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              </div>
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-extrabold text-emerald-800' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
