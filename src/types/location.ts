export interface Location {
  id: string;
  name: string;
  active: boolean;
}

export type LocationId = 'aimogasta' | 'olascoaga';
export type LocationSelection = LocationId | 'all';

export const OFFICIAL_LOCATIONS: Location[] = [
  {
    id: 'aimogasta',
    name: 'Aimogasta',
    active: true,
  },
  {
    id: 'olascoaga',
    name: 'Olascoaga',
    active: true,
  },
];

export function getLocationName(locationId?: string): string {
  if (!locationId) return 'Sin Especificar';
  if (locationId === 'all') return 'Todas las ubicaciones';
  const found = OFFICIAL_LOCATIONS.find((l) => l.id === locationId);
  return found ? found.name : locationId;
}
