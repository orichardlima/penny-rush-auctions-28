// Service Worker para funcionalidades PWA
const CACHE_NAME = 'leiloes-online-v1';
const STATIC_ASSETS = [
  '/',
  '/leiloes',
  '/dashboard',
  '/auth',
  '/manifest.json',
  '/favicon.ico'
];

// Instalar Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
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
  console.log('🚀 Service Worker: Ativando...');
  
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

// Interceptar requisições
self.addEventListener('fetch', event => {
  console.log('🌐 SW: Interceptando requisição', event.request.method, event.request.url);
  
  // Estratégia: Network First para API calls, Cache First para assets estáticos
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase.co')) {
    // Network first para dados dinâmicos
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // CRÍTICO: Só cachear requisições GET com sucesso
          if (response.status === 200 && event.request.method === 'GET') {
            try {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone)
                    .catch(cacheError => {
                      console.log('⚠️ SW: Erro ao cachear (ignorado):', cacheError.message);
                    });
                })
                .catch(openError => {
                  console.log('⚠️ SW: Erro ao abrir cache (ignorado):', openError.message);
                });
            } catch (cloneError) {
              console.log('⚠️ SW: Erro ao clonar resposta (ignorado):', cloneError.message);
            }
          } else if (event.request.method !== 'GET') {
            console.log('📝 SW: Requisição', event.request.method, 'não cacheada (método não GET)');
          }
          return response;
        })
        .catch(networkError => {
          console.log('❌ SW: Erro de rede para', event.request.url, networkError.message);
          // Se a rede falha, tenta o cache (apenas para GET)
          if (event.request.method === 'GET') {
            return caches.match(event.request);
          }
          // Para métodos não GET, falha imediatamente
          throw networkError;
        })
    );
  } else {
    // Cache first para assets estáticos
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            console.log('📦 SW: Servindo do cache:', event.request.url);
            return response;
          }
          console.log('🌐 SW: Buscando na rede:', event.request.url);
          return fetch(event.request);
        })
    );
  }
});

// Notificações Push (preparação para futuras funcionalidades)
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    data: data.url,
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
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
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});