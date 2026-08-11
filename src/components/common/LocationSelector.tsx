import React from 'react';
import { MapPin, Building2, ChevronDown } from 'lucide-react';
import { useLocation } from '../../context/LocationContext';
import { LocationId, LocationSelection } from '../../types/location';

interface LocationSelectorProps {
  allowAll?: boolean; // If true, allows selecting "TODOS" (for Reports/Analysis)
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  allowAll = false,
  size = 'md',
  className = '',
}) => {
  const { activeLocation, reportLocationFilter, setActiveLocation, setReportLocationFilter } = useLocation();

  if (allowAll) {
    return (
      <div className={`inline-flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200/80 rounded-2xl ${className}`}>
        <button
          type="button"
          onClick={() => setReportLocationFilter('all')}
          className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
            reportLocationFilter === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          TODAS
        </button>
        <button
          type="button"
          onClick={() => setReportLocationFilter('aimogasta')}
          className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
            reportLocationFilter === 'aimogasta'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          AIMOGASTA
        </button>
        <button
          type="button"
          onClick={() => setReportLocationFilter('olascoaga')}
          className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
            reportLocationFilter === 'olascoaga'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          OLASCOAGA
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-2xl shadow-2xs ${className}`}>
      <button
        type="button"
        onClick={() => setActiveLocation('aimogasta')}
        className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
          activeLocation === 'aimogasta'
            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 ring-1 ring-emerald-500'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
        }`}
      >
        <MapPin className="w-3.5 h-3.5" />
        <span>Aimogasta</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveLocation('olascoaga')}
        className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
          activeLocation === 'olascoaga'
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 ring-1 ring-indigo-500'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
        }`}
      >
        <MapPin className="w-3.5 h-3.5" />
        <span>Olascoaga</span>
      </button>
    </div>
  );
};
