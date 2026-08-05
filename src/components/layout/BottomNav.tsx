import React from 'react';
import { NavigationTab } from '../../types/product';
import { Home, Package, Users, ShoppingCart, Boxes, Receipt, Wallet } from 'lucide-react';

interface BottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-1 py-1.5">
      <div className="max-w-lg mx-auto flex items-center justify-between text-center overflow-x-auto no-scrollbar">
        {/* Home Tab */}
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-1.5 shrink-0 ${
            currentTab === 'home' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className={`w-5 h-5 ${currentTab === 'home' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Inicio</span>
        </button>

        {/* Sales / Cart Tab */}
        <button
          onClick={() => onSelectTab('sales')}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-1.5 shrink-0 ${
            currentTab === 'sales' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingCart className={`w-5 h-5 ${currentTab === 'sales' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Venta</span>
        </button>

        {/* Caja Tab */}
        <button
          onClick={() => onSelectTab('cash')}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-1.5 shrink-0 ${
            currentTab === 'cash' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet className={`w-5 h-5 ${currentTab === 'cash' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Caja</span>
        </button>

        {/* Stock Tab */}
        <button
          onClick={() => onSelectTab('stock')}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-1.5 shrink-0 ${
            currentTab === 'stock' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className={`w-5 h-5 ${currentTab === 'stock' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Stock</span>
        </button>

        {/* Expenses Tab */}
        <button
          onClick={() => onSelectTab('expenses')}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-1.5 shrink-0 ${
            currentTab === 'expenses' ? 'text-rose-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className={`w-5 h-5 ${currentTab === 'expenses' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Gastos</span>
        </button>

        {/* Customers Tab */}
        <button
          onClick={() => onSelectTab('customers')}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-1.5 shrink-0 ${
            currentTab === 'customers' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className={`w-5 h-5 ${currentTab === 'customers' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Clientes</span>
        </button>

        {/* Products List Tab */}
        <button
          onClick={() => onSelectTab('list')}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-1.5 shrink-0 ${
            currentTab === 'list' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className={`w-5 h-5 ${currentTab === 'list' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Catálogo</span>
        </button>
      </div>
    </nav>
  );
};
