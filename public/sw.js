// Service Worker para funcionalidades PWA
const CACHE_NAME = 'leiloes-online-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico'
];

// Instalar Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker v2: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Cache aberto');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Instalado com sucesso');
        return self.skipWaiting();
      })
  );
});

// Ativar Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker v2: Ativando...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Removendo cache antigo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Ativado com sucesso');
      return self.clients.claim();
    })
  );
});

// Helper: é uma requisição de navegação (HTML)?
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Helper: é um asset com hash do Vite? (ex: /assets/index-abc123.js)
function isHashedAsset(url) {
  return /\/assets\/.*-[a-f0-9]{8,}\.(js|css)$/.test(url);
}

// Interceptar requisições
self.addEventListener('fetch', event => {
  const { request } = event;

  // 1. Navegação (HTML) → SEMPRE Network First
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cachear a versão mais recente do HTML
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
          return response;
        })
        .catch(() => {
          // Offline: tentar cache como fallback
          return caches.match(request).then(cached => cached || caches.match('/'));
        })
    );
    return;
  }

  // 2. Assets com hash do Vite → Cache First (hash garante unicidade)
  if (isHashedAsset(request.url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. API / Supabase → Network only (nunca cachear)
  if (request.url.includes('/api/') || request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(err => {
        return new Response(JSON.stringify({ message: err.message }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 4. Outros assets estáticos (imagens, fontes, manifest) → Network First
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Aceitar comando SKIP_WAITING do app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notificações Push
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    data: data.url,
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data || '/'));
  }
});
