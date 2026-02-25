

# Tornar bots independentes do admin: PL/pgSQL + pg_cron direto

## Problema

O hook `useRealTimeProtection` só roda para admins (a cada 5s). Sem admin online, o sistema depende de um cron de 1 minuto que chama a edge function via `pg_net` — que frequentemente dá timeout porque a function leva 5-11s (limite do pg_net é 5s). Resultado: gaps de 3-10 minutos sem bots.

## Solução

Mover a lógica central de bot para uma **database function PL/pgSQL** executada **diretamente** pelo pg_cron a cada minuto, mas com **loop interno de 6 iterações com `pg_sleep(10)`**, garantindo execução a cada ~10 segundos. Zero dependência de pg_net ou edge functions para os bots.

## Alterações

### 1. Criar database function `bot_protection_loop()`

Uma função PL/pgSQL que:
- Faz 6 iterações (cobrindo ~60 segundos)
- Em cada iteração, espera 10s (`pg_sleep(10)`)
- Para cada leilão ativo:
  - Calcula `seconds_since_last_bid` usando `last_bid_at`
  - Se inatividade >= 8s → insere bid de bot (100% garantido)
  - Se inatividade 5-7s → insere com 30% de probabilidade (`random() < 0.3`)
  - Anti-spam: verifica se já há bid com `cost_paid = 0` nos últimos 5s
  - Verifica finalização: meta atingida, preço máximo, horário limite → finaliza
  - Verifica prejuízo: preço > valor de mercado → finaliza
- Usa `get_random_bot()` (já existe) para selecionar bot
- O trigger `update_auction_on_bid` já cuida de resetar `time_left = 15`

### 2. Substituir o cron job atual (jobid 46)

- Remover o cron que chama `sync-timers-and-protection` via pg_net
- Criar novo cron: `SELECT public.bot_protection_loop()` executado diretamente a cada minuto
- Sem pg_net = sem timeout de 5s = 100% de confiabilidade

### 3. Manter a edge function `sync-timers-and-protection`

A edge function continua existindo para:
- Ser chamada pelo hook do admin (funcionalidade extra, não dependência)
- Ativar leilões em espera (`waiting` → `active`)
- Distribuir Fury Vault na finalização

A diferença é que os bots **não dependem mais** dela.

### 4. Remover restrição de admin do hook (opcional mas recomendado)

No `useRealTimeProtection.ts`, remover o check `if (!profile?.is_admin)` para que qualquer usuário logado contribua para acionar a edge function. Mas isso é apenas um **bônus** — o pg_cron já garante os bots sozinho.

## Diagrama do fluxo

```text
ANTES:
  Admin online → hook 5s → edge function → bot bid ✅
  Admin offline → cron 60s → pg_net → edge function (timeout 76%) ❌

DEPOIS:
  pg_cron 60s → bot_protection_loop() [6 iterações × pg_sleep(10)] → bot bid ✅
  (Nenhuma dependência de admin, pg_net ou edge function)
```

## Detalhes técnicos da function

A function `bot_protection_loop()` terá:
- `SECURITY DEFINER` para acessar todas as tabelas
- `SET statement_timeout = '90s'` para permitir o loop de ~60s
- Lógica simplificada comparada à edge function (sem delays artificiais, sem embaralhamento)
- Log via `RAISE LOG` para auditoria no Postgres logs

## Arquivos modificados

- **Nenhum arquivo de código** é alterado (a UI e hooks permanecem intactos)
- **SQL migration**: cria a function `bot_protection_loop()` e substitui o cron job

