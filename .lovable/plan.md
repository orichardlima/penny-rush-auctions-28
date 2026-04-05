

# Ajuste Agressivo de Thresholds — Edge Function + SQL

## Resumo

3 edições pontuais na edge function + 1 migration SQL. Nenhum arquivo frontend alterado.

## 1. Edge Function `sync-timers-and-protection/index.ts` — 3 edições

**Linha 187**: delay entre leilões
- De: `getRandomDelay(1000, 4000)`
- Para: `getRandomDelay(500, 1500)`

**Linha 229**: finalização por inatividade (prioridade sobre lance probabilístico)
- De: `secondsSinceLastBid > 30`
- Para: `secondsSinceLastBid >= 12`

**Linhas 242-244**: lance probabilístico
- De: `>= 13 ? 1.0 : >= 10 ? 0.25 : 0`
- Para: `>= 8 ? 1.0 : >= 6 ? 0.5 : 0`

## 2. Nova migration SQL — `bot_protection_loop` com 2 edições

**Linha 178**: safety net inatividade
- De: `> 60`
- Para: `>= 20`

**Linhas 217-223**: lance probabilístico
- De: `>= 13 → 1.0, >= 10 → 0.25`
- Para: `>= 8 → 1.0, >= 6 → 0.5`

## 3. Deploy da edge function

## Regras de prioridade (confirmadas pela ordem do código)

| Inatividade | Ação |
|-------------|------|
| 0-5s | Nenhuma |
| 6-7s | Lance bot (50%) |
| 8-11s | Lance bot (100%) |
| >= 12s | Finalizar (edge function) |
| >= 20s | Finalizar (SQL fallback) |

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sync-timers-and-protection/index.ts` | 3 thresholds + delay |
| Nova migration SQL | `bot_protection_loop` com thresholds 6s/8s/20s |

