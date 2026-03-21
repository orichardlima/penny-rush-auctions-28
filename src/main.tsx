import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import { SkipLink } from './components/SkipLink.tsx'
import { logChunkError, markReloadAttempted, wasReloadRecent, clearReloadFlag } from './utils/chunkErrorTelemetry.ts'
import './index.css'

// Limpar flag de reload se a página carregou com sucesso
if (wasReloadRecent()) {
  console.log('✅ [CHUNK-RECOVERY] Reload resolveu o problema de chunk');
  clearReloadFlag();
}

// Listener global para erros de preload do Vite
window.addEventListener('vite:preloadError', (event: Event) => {
  const e = (event as unknown as { payload?: unknown }).payload ?? event;
  logChunkError(e, 'vite:preloadError');
  
  if (!wasReloadRecent()) {
    markReloadAttempted();
    window.location.reload();
  }
});

// Registrar Service Worker com updateOnReload
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registrado');
        
        // Quando uma nova versão do SW estiver disponível, ativar imediatamente
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('🔄 Novo Service Worker ativado');
              }
            });
          }
        });
        
        // Verificar atualizações periodicamente
        setInterval(() => registration.update(), 60 * 60 * 1000); // 1h
      })
      .catch(error => console.log('❌ SW error:', error));
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <SkipLink />
    <App />
  </HelmetProvider>
);
