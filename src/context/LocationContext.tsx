import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LocationSelection, LocationId, OFFICIAL_LOCATIONS, Location } from '../types/location';

interface LocationContextType {
  currentLocation: LocationSelection;
  setCurrentLocation: (loc: LocationSelection) => void;
  activeOperationalLocation: LocationId;
  activeLocation: LocationId;
  setActiveLocation: (loc: LocationId) => void;
  reportLocationFilter: LocationSelection;
  setReportLocationFilter: (loc: LocationSelection) => void;
  isAllSelected: boolean;
  locations: Location[];
  getLocationName: (id?: string) => string;
}

const STORAGE_KEY = 'despensa_stock_active_location_id';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocationState] = useState<LocationSelection>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'aimogasta' || saved === 'olascoaga' || saved === 'all') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'aimogasta';
  });

  const setCurrentLocation = (loc: LocationSelection) => {
    setCurrentLocationState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch (err) {
      console.warn('Failed to persist location in localStorage:', err);
    }
  };

  const activeOperationalLocation: LocationId = 
    currentLocation === 'olascoaga' ? 'olascoaga' : 'aimogasta';

  const isAllSelected = currentLocation === 'all';

  const getLocationName = (id?: string): string => {
    if (!id) return 'Sin Especificar';
    if (id === 'all') return 'Todas las ubicaciones';
    const found = OFFICIAL_LOCATIONS.find(l => l.id === id);
    return found ? found.name : id;
  };

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        setCurrentLocation,
        activeOperationalLocation,
        activeLocation: activeOperationalLocation,
        setActiveLocation: (loc: LocationId) => setCurrentLocation(loc),
        reportLocationFilter: currentLocation,
        setReportLocationFilter: (loc: LocationSelection) => setCurrentLocation(loc),
        isAllSelected,
        locations: OFFICIAL_LOCATIONS,
        getLocationName,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
