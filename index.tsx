
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
// Fuentes autoalojadas: offline real desde la primera carga (sin Google Fonts).
// Pesos usados por Tailwind: sans = Inter 400/700/900, mono = JetBrains Mono 400/700.
// Solo el subconjunto latino (la app es en español): evita empaquetar cirílico,
// griego y vietnamita, que multiplicarían el peso de `dist/` sin usarse.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-900.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
