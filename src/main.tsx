import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {APP_ENV} from './utils/firebaseSync';

// Test environment: a label on every screen and in the browser tab, so the
// test site is never mistaken for the live system (docs/ENVIRONMENTS.md).
if (APP_ENV === 'test') document.title = `[TEST] ${document.title}`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {APP_ENV === 'test' && (
      <div
        className="fixed bottom-3 left-3 z-[9999] pointer-events-none select-none rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-black shadow-lg ring-2 ring-black/20"
        title="Test environment: separate database and users from the live system"
      >
        Test environment
      </div>
    )}
  </StrictMode>,
);
