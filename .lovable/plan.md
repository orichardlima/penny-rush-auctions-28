

# Correção completa: chunks stale, spinner infinito e cache problemático

## Diagnóstico

O Service Worker (`public/sw.js`) é o principal culpado. Ele usa **Cache First** para todos os assets estáticos (linha 92-105), incluindo o `index.html` e os chunks JS. Após cada deploy, o SW serve versões antigas do `index.html` que referenciam chunks com hashes antigos que não existem mais. O resultado: erro de import silencioso → Suspense preso no spinner → loop infinito.

## Plano de correção (5 partes)

### 1. Corrigir o Service Worker (`public/sw.js`)

- Mudar a estratégia do `index.html` para **Network First** (nunca servir HTML antigo do cache)
- Excluir arquivos `.js` e `.css` com hash do cache estático (Vite gera novos a cada build)
- Remover `/`, `/leiloes`, `/dashboard`, `/auth` do array `STATIC_ASSETS` (são rotas SPA, não arquivos estáticos)
- Incrementar `CACHE_NAME` para `v2` para forçar limpeza do cache antigo
- Adicionar listener de `message` para aceitar comando `SKIP_WAITING` do app

### 2. Criar `lazyWithRetry` e ErrorBoundary (`src/App.tsx`)

- Função `lazyWithRetry`: envolve `React.lazy()` com retry. Se o import falhar, tenta reload uma vez (usando `sessionStorage` para evitar loop)
- Componente `ChunkErrorBoundary`: React ErrorBoundary que captura erros de import e exibe tela amigável com botão "Recarregar" em vez de spinner infinito
- Envolver todas as rotas lazy com `<ChunkErrorBoundary>` + `<Suspense>`
- O `PageLoader` ganha um timeout de 15s: se ultrapassar, mostra mensagem de erro com botão de reload

### 3. Listener global em `src/main.tsx`

- Adicionar listener `vite:preloadError` que força reload (com proteção anti-loop via `sessionStorage`)
- Registrar o SW com `updateOnReload: true` para que novas versões assumam imediatamente

### 4. Telemetria de erros de chunk (novo `src/utils/chunkErrorTelemetry.ts`)

- Função que loga no console com detalhes:
  - Rota onde ocorreu o erro (`window.location.pathname`)
  - Nome do chunk que falhou
  - Se o reload foi tentado e se resolveu
  - Timestamp
- Opcionalmente envia para o Supabase (tabela de logs) para monitoramento

### 5. PageLoader com timeout (`src/App.tsx`)

- O `PageLoader` atual é um spinner sem limite de tempo
- Adicionar `useEffect` com `setTimeout(15000)` que muda o estado para "erro"
- Estado de erro mostra: "A página não carregou. Isso pode acontecer após uma atualização." + botão "Recarregar página"

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `public/sw.js` | Network First para HTML/navegação, cache v2, excluir rotas SPA |
| `src/main.tsx` | Listener `vite:preloadError`, SW com `updateOnReload` |
| `src/App.tsx` | `lazyWithRetry`, `ChunkErrorBoundary`, `PageLoader` com timeout |
| `src/utils/chunkErrorTelemetry.ts` | Novo arquivo -- logs de erros de chunk |

## Resultado esperado

- Usuário com cache antigo → SW busca HTML novo da rede → chunks corretos carregam
- Chunk falha mesmo assim → retry automático com reload (1 tentativa)
- Reload não resolve → tela de erro amigável com botão manual (nunca spinner infinito)
- Telemetria registra cada ocorrência para monitoramento

