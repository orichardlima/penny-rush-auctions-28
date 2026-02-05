
# Plano: Melhorar Estabilidade da Conexão Realtime em Mobile

## Problema Identificado

A mensagem "Conexão perdida - Tentando reconectar..." aparece frequentemente em celulares porque:

1. Navegadores mobile fazem "throttling" (reduzem execução de JavaScript) quando a aba está em segundo plano
2. Os heartbeats do Supabase Realtime não são enviados a tempo
3. O servidor assume que o cliente desconectou e fecha a conexão
4. Ao retornar, o sistema detecta a desconexão e exibe o toast

Este é um comportamento normal e esperado em redes móveis, mas a experiência pode ser melhorada.

---

## Solução Proposta

Implementar as melhores práticas recomendadas pelo Supabase para conexões Realtime estáveis:

### 1. Habilitar Web Worker para Heartbeats

Mover a lógica de heartbeat para um Web Worker, que é menos afetado pelo throttling do navegador:

```typescript
// No cliente Supabase
realtime: {
  worker: true,  // Heartbeats em thread separada
}
```

### 2. Implementar heartbeatCallback para Reconexão Automática

Detectar desconexões silenciosas e reconectar automaticamente:

```typescript
realtime: {
  heartbeatCallback: (status) => {
    if (status === 'disconnected') {
      client.connect()  // Reconectar automaticamente
    }
  },
}
```

### 3. Melhorar Experiência de Reconexão

- Não mostrar toast de "Conexão perdida" imediatamente (esperar 3-5 segundos)
- Mostrar toast apenas se a reconexão demorar muito tempo
- Mostrar indicador sutil ao invés de toast intrusivo

---

## Arquivos a Serem Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/integrations/supabase/client.ts` | Adicionar `worker: true` e `heartbeatCallback` na configuração Realtime |
| `src/contexts/AuctionRealtimeContext.tsx` | Melhorar lógica de tratamento de desconexão e reconexão |

---

## Detalhes Técnicos

### Mudança no Cliente Supabase

O arquivo `src/integrations/supabase/client.ts` será atualizado para:

```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    worker: true,  // NOVO: Heartbeats via Web Worker
    heartbeatCallback: (status) => {
      if (status === 'disconnected') {
        // Reconectar automaticamente quando heartbeat falha
        supabase.realtime.connect()
      }
    },
  }
});
```

### Mudança no Context de Leilões

O `AuctionRealtimeContext.tsx` será atualizado para:

1. Adicionar delay antes de mostrar toast de desconexão
2. Usar um indicador visual sutil ao invés de toast (opcional)
3. Cancelar o toast se reconectar rapidamente

Exemplo da lógica:

```typescript
let disconnectTimeoutRef = useRef<NodeJS.Timeout>();

// No subscribe callback:
if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
  // Aguardar 5 segundos antes de alertar o usuario
  disconnectTimeoutRef.current = setTimeout(() => {
    toast({
      title: "Conexão instável",
      description: "Reconectando automaticamente...",
      variant: "default",  // Menos alarmante
    });
  }, 5000);
  
  // Ativar polling de emergencia
  // ...
  
} else if (status === 'SUBSCRIBED') {
  // Cancelar toast pendente se reconectou rapidamente
  if (disconnectTimeoutRef.current) {
    clearTimeout(disconnectTimeoutRef.current);
  }
  // ...
}
```

---

## Benefícios Esperados

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Toast de desconexão | Aparece imediatamente | Aparece só após 5s sem conexão |
| Heartbeats em background | Throttled pelo navegador | Executam via Web Worker |
| Reconexão | Manual/polling | Automática via heartbeatCallback |
| Experiência mobile | Toasts frequentes | Reconexão silenciosa |

---

## Fluxo de Reconexão

```text
┌─────────────────────────────────────────────────────────────────┐
│                    USUARIO EM MOBILE                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Navegador coloca aba em background (throttling ativado)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ANTES: Heartbeats param, servidor desconecta                   │
│  DEPOIS: Web Worker mantém heartbeats, conexão estável          │
└─────────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
               ▼                             ▼
┌────────────────────────┐     ┌─────────────────────────────────┐
│  Se desconectar mesmo  │     │  Se conexão mantida             │
│  assim:                │     │                                 │
│  - heartbeatCallback   │     │  - Nenhuma ação necessária      │
│    detecta             │     │  - Usuário não percebe nada     │
│  - Reconecta auto      │     │                                 │
│  - Toast só após 5s    │     │                                 │
└────────────────────────┘     └─────────────────────────────────┘
```

---

## Considerações

1. **Service Worker existente**: O projeto já tem um `public/sw.js`. A opção `worker: true` do Supabase usa um Web Worker interno, não conflita.

2. **Compatibilidade**: Web Workers são suportados em 97%+ dos navegadores, incluindo todos os móveis modernos.

3. **Fallback**: Se Web Worker não estiver disponível, o Supabase automaticamente usa a thread principal.

---

## Resultado Esperado

Após a implementação:
- Usuários mobile verão muito menos mensagens de "Conexão perdida"
- Reconexões acontecem silenciosamente em segundo plano
- A experiência será mais fluida e menos interruptiva
- Dados continuam sincronizando normalmente
