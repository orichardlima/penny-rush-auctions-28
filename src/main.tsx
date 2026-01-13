import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import { SkipLink } from './components/SkipLink.tsx'
import { CookieConsent } from './components/CookieConsent.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <SkipLink />
    <App />
    <CookieConsent />
  </HelmetProvider>
);
