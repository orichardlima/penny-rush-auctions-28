

# Implementação: Motor de Bots com Timing Natural por Agendamento

## Resumo

2 mudanças: 1 migration SQL (3 colunas + trigger modificado + bot_protection_loop reescrito) e 1 edição na edge function. Zero mudanças no frontend.

## 1. Migration SQL

Uma única migration com 3 partes:

### 1a. Adicionar 3 colunas à tabela `auctions`
```sql
scheduled_bot_bid_at timestamptz DEFAULT NULL
scheduled_bot_band text DEFAULT NULL
last_bot_band text DEFAULT NULL
```

### 1b. Recriar trigger `update_auction_on_bid()`
Adicionar ao UPDATE existente (linhas 92-102 da versão atual):
```sql
scheduled_bot_bid_at = NULL,
scheduled_bot_band = NULL
```
Todo novo lance (humano ou bot) invalida o agendamento pendente. Restante da função idêntico.

### 1c. Recriar `bot_protection_loop`
Substituir o bloco probabilístico (linhas 210-278) por lógica de agendamento:

**Prioridades mantidas na ordem**:
1. Finalização por time_limit, max_price, revenue_target (inalteradas)
2. Finalização por inatividade >= 40s (safety net, subir de 20s)

**Nova lógica**:

3. **Executar agendamento vencido**: se `scheduled_bot_bid_at IS NOT NULL AND now() >= scheduled_bot_bid_at`:
   - Validar ciclo: `scheduled_bot_bid_at >= last_bid_at`
   - Se válido: inserir lance, `UPDATE last_bot_band = scheduled_bot_band`, limpar schedule
   - Se obsoleto: apenas limpar schedule (RAISE LOG `[BOT-STALE]`)

4. **Agendar novo lance**: se `scheduled_bot_bid_at IS NULL AND inatividade >= 5s`:
   - Sortear faixa (anti-repetição vs `last_bot_band`, re-sortear 1x se igual)
   - Faixas: early (2-5s, 20%), middle (6-9s, 40%), late (10-12s, 30%), sniper (13-14s, 10%)
   - `scheduled_bot_bid_at = last_bid_at + delay_sorteado * interval '1 second'`
   - Gravar `scheduled_bot_band`

## 2. Edge Function `sync-timers-and-protection/index.ts`

### SELECT (linha 165)
Adicionar `scheduled_bot_bid_at, scheduled_bot_band, last_bot_band` ao SELECT.

### Nova função helper `selectBotBand(lastBotBand)`
Sorteia faixa com pesos 20/40/30/10 e anti-repetição vs lastBotBand.

### Substituir bloco probabilístico (linhas 228-293)

**Inatividade >= 30s**: finalizar com bot (subir de 12s). Prioridade sobre agendamento.

**Fase A — Executar agendamento vencido**:
- Se `scheduled_bot_bid_at != null && now >= scheduled_bot_bid_at`:
  - Se `scheduled_bot_bid_at >= last_bid_at`: executar lance, setar `last_bot_band`, limpar schedule
  - Se `scheduled_bot_bid_at < last_bid_at`: descartar (log `[BOT-STALE]`)
- Se `scheduled_bot_bid_at != null && now < scheduled_bot_bid_at`: skip (ainda não é hora)

**Fase B — Agendar novo lance**:
- Se `scheduled_bot_bid_at == null && secondsSinceLastBid >= 5`:
  - Sortear faixa, calcular `scheduled_bot_bid_at = last_bid_at + delay`
  - UPDATE atômico `WHERE scheduled_bot_bid_at IS NULL` (previne duplo agendamento)

### Logs de auditoria
```
🤖 [BOT-SCHEDULE] "PS5" | band=middle | target=10:00:08
🤖 [BOT-EXEC] "PS5" | band=middle | scheduled=10:00:08 | executed=10:00:10 | R$1.05
🗑️ [BOT-STALE] "PS5" | agendamento obsoleto descartado
```

### Summary response
Adicionar `bot_bids_scheduled` ao JSON de resposta.

## 3. Deploy da edge function

## Regras de prioridade finais

| Inatividade | Ação |
|-------------|------|
| 0-4s | Nenhuma |
| >= 5s | Agendar lance (se não houver agendamento) |
| Horário-alvo | Executar lance agendado |
| >= 30s | Edge function finaliza com bot |
| >= 40s | SQL finaliza com bot (fallback) |

## Atomicidade e corrida

- **Agendamento**: `UPDATE WHERE scheduled_bot_bid_at IS NULL` previne duplo agendamento
- **Invalidação**: trigger limpa schedule a cada novo lance
- **Ciclo válido**: `scheduled_bot_bid_at >= last_bid_at` impede execução de agendamento obsoleto
- **Edge vs SQL**: quem chegar primeiro executa; o outro não encontra agendamento pendente

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | 3 colunas + trigger atualizado + bot_protection_loop reescrito |
| `supabase/functions/sync-timers-and-protection/index.ts` | Substituir lance probabilístico por agendar/executar; inatividade 12s→30s |

