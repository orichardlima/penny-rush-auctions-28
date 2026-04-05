

# Contenção urgente: Quebrar o feedback loop do pg_net trigger

## Diagnóstico

O banco está em cascata de statement timeouts por causa de um **feedback loop**:

```text
Edge Function (agenda bot) 
  → UPDATE scheduled_bot_bid_at
    → trg_notify_bot_bid_scheduled (pg_net) 
      → chama Edge Function novamente
        → execute_overdue_bot_bids (FOR UPDATE SKIP LOCKED) 
          → timeout sob concorrência
            → múltiplas invocações simultâneas saturando o banco
```

Nos logs: a edge function está sendo chamada **várias vezes por segundo** (não a cada 15s como o polling deveria causar). Cada chamada dispara o RPC `execute_overdue_bot_bids` que está dando timeout.

## Ação imediata (menor risco possível)

### 1. Desabilitar o trigger pg_net

Nova migration SQL:

```sql
ALTER TABLE public.auctions DISABLE TRIGGER trg_notify_bot_bid_scheduled;
```

Isso quebra o feedback loop imediatamente. O polling de 15s e o pg_cron de 1min continuam funcionando como camadas de execução.

### 2. Nenhuma outra mudança

- Não alterar a edge function
- Não alterar o polling
- Não alterar o `execute_overdue_bot_bids`
- Manter tudo mais como está

## Por que isso é seguro

- O trigger pg_net foi adicionado hoje como otimização. Removê-lo volta ao modelo que já funcionava (polling 15s + cron 1min)
- A edge function continua sendo chamada normalmente pelo frontend a cada 15s
- O pg_cron continua executando `execute_overdue_bot_bids` a cada 1 minuto
- Zero mudança de código frontend ou edge function

## Monitoramento pós-deploy

1. Statement timeouts devem parar imediatamente
2. Erros 406 no profiles devem desaparecer
3. Edge function deve voltar a execuções rápidas (100-300ms)
4. Auth e home devem voltar ao normal

## Próxima etapa (após estabilizar)

Avaliar se o trigger pg_net pode ser reintroduzido com proteções:
- Debounce (não disparar se já disparou nos últimos N segundos)
- Ou substituir por uma abordagem que não crie feedback loop

## Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | `DISABLE TRIGGER trg_notify_bot_bid_scheduled` |

