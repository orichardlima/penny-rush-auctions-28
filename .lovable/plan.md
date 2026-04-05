

# Executor backend sub-minuto: avaliação de opções

## Problema

O pg_cron do Postgres suporta no mínimo 1 execução por minuto. Não existe sintaxe de segundos. O trigger pg_net foi desabilitado por causar feedback loop. O frontend faz polling a cada 15s mas nem sempre cobre os agendamentos de 2-14s.

**Camadas atuais de execução e suas limitações:**

```text
Camada                  Frequência   Limitação
─────────────────────── ──────────── ─────────────────────────────
Frontend polling        15s          Depende de cliente conectado
pg_cron bot-loop        60s          Granularidade mínima do cron
pg_cron execute_overdue 60s          Idem
pg_net trigger          desabilitado Causou feedback loop
```

## Opções viáveis

### Opção A: Serviço externo de cron (recomendada)

Usar um serviço como cron-job.org, EasyCron, ou UptimeRobot para chamar a edge function `sync-timers-and-protection` a cada 10 segundos via HTTP POST.

**Vantagens:**
- Zero mudança de código ou banco
- Frequência exata de 10s
- Cada chamada é leve (<300ms)
- Não depende de cliente conectado
- Sem risco de feedback loop

**Desvantagens:**
- Dependência de serviço externo
- Precisa configurar fora do Supabase

**Implementação:** Configurar o serviço para fazer POST a cada 10s em:
```
https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection
Headers: Authorization: Bearer <anon_key>, Content-Type: application/json
Body: {"trigger": "external_cron"}
```

### Opção B: pg_cron + pg_net disparando múltiplas chamadas por minuto

Criar uma função SQL que pg_cron chama a cada minuto. Essa função dispara 6 chamadas pg_net para a edge function. Problema: todas disparam simultaneamente (pg_net é assíncrono e imediato), então não cobre os 10s de intervalo.

**Veredicto:** Não resolve o problema. Descartada.

### Opção C: Re-habilitar pg_net trigger com proteção anti-loop

Recriar o trigger para:
- Só disparar quando `scheduled_bot_bid_at` muda de NULL para NOT NULL
- Adicionar debounce: não disparar se já disparou nos últimos 5s para o mesmo leilão

**Problema:** O trigger dispara quando o schedule é CRIADO (futuro), não quando vence. Chamar a edge function imediatamente não encontra nada para executar. A edge function teria que esperar internamente, voltando ao modelo rejeitado.

**Veredicto:** Não resolve sem espera bloqueante. Descartada.

### Opção D: Edge function auto-encadeada

A edge function, após executar, usa `fetch()` para chamar a si mesma com um `setTimeout` de 10s. Limitar a 5 iterações (50s de cobertura).

**Problema:** Edge function fica ativa por até 50s. Consome recursos. É essencialmente um loop disfarçado.

**Veredicto:** Viável mas vai contra o princípio de execuções rápidas. Risco moderado.

## Recomendação

**Opção A (serviço externo)** é a única que resolve o problema de forma limpa dentro das restrições:
- Sem loops
- Sem pg_sleep
- Sem feedback loops
- Execuções rápidas (<300ms cada)
- Cobertura real de 10s

**Próximo passo:** Escolher um serviço (cron-job.org é gratuito para 1 job a cada 10s) e configurar. Nenhuma mudança de código necessária, apenas configuração externa.

## Pergunta

Qual opção deseja seguir? Se opção A, posso fornecer as instruções exatas de configuração do serviço externo.

