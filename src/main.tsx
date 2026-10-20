import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LocationProvider } from './context/LocationContext';
import './index.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocationProvider>
      <App />
    </LocationProvider>
  </StrictMode>,
);

