/**
 * DespensaStock v2 — punto de entrada de la interfaz.
 * La versión anterior de las pantallas sigue en src/pages y src/components (no se borró),
 * pero ya no se usa. Los datos y servicios de Firebase son los mismos.
 */
import React from 'react';
import { DataProvider } from './data/DataContext';
import { Shell } from './ui/Shell';

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}
