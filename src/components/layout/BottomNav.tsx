import React from 'react';
import { NavigationTab } from '../../types/product';
import { Home, ScanLine, Package, Users, ShoppingCart, Boxes } from 'lucide-react';

interface BottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-1 py-1.5">
      <div className="max-w-lg mx-auto flex items-center justify-around relative text-center">
        {/* Home Tab */}
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center gap-0.5 transition-colors py-1 px-1 ${
            currentTab === 'home' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className={`w-4 h-4 sm:w-5 sm:h-5 ${currentTab === 'home' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Inicio</span>
        </button>

        {/* Sales / Cart Tab */}
        <button
          onClick={() => onSelectTab('sales')}
          className={`flex flex-col items-center gap-0.5 transition-colors py-1 px-1 ${
            currentTab === 'sales' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingCart className={`w-4 h-4 sm:w-5 sm:h-5 ${currentTab === 'sales' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Venta</span>
        </button>

        {/* Stock Tab */}
        <button
          onClick={() => onSelectTab('stock')}
          className={`flex flex-col items-center gap-0.5 transition-colors py-1 px-1 ${
            currentTab === 'stock' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className={`w-4 h-4 sm:w-5 sm:h-5 ${currentTab === 'stock' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Stock</span>
        </button>

        {/* CENTER PROMINENT SCAN BUTTON */}
        <div className="relative -top-4 mx-0.5">
          <button
            onClick={() => onSelectTab('scan')}
            className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex flex-col items-center justify-center shadow-lg shadow-emerald-600/30 ring-4 ring-white active:scale-95 transition-all ${
              currentTab === 'scan' ? 'scale-105 ring-emerald-200' : ''
            }`}
            title="Escanear producto"
          >
            <ScanLine className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Customers Tab */}
        <button
          onClick={() => onSelectTab('customers')}
          className={`flex flex-col items-center gap-0.5 transition-colors py-1 px-1 ${
            currentTab === 'customers' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className={`w-4 h-4 sm:w-5 sm:h-5 ${currentTab === 'customers' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Clientes</span>
        </button>

        {/* Products List Tab */}
        <button
          onClick={() => onSelectTab('list')}
          className={`flex flex-col items-center gap-0.5 transition-colors py-1 px-1 ${
            currentTab === 'list' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className={`w-4 h-4 sm:w-5 sm:h-5 ${currentTab === 'list' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Catálogo</span>
        </button>
      </div>
    </nav>
  );
};
