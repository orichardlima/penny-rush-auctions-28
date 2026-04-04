

# Finalização Automática Obrigatória com Bot Vencedor

## Resumo

4 arquivos frontend + 1 migration SQL + 1 edge function. Proteção global, sem dependência de admin, safety net em duas camadas (edge 30s / SQL 60s), atomicidade, auditoria com `finish_reason`.

## 1. `src/hooks/useRealTimeProtection.ts` — Reescrever

- Remover guard `!profile?.is_admin` — usar `user` do `useAuth()` como gate
- Alterar intervalo de 5000ms para **10000ms**
- Limpar logs verbosos, manter apenas log de erro
- Dependência muda de `profile?.is_admin` para `user?.id`

## 2. `src/App.tsx` — Adicionar hook global

- Importar `useRealTimeProtection` de `@/hooks/useRealTimeProtection`
- Chamar `useRealTimeProtection()` dentro de `AppContent` (junto dos outros hooks na linha 161-162)

## 3. `src/pages/Index.tsx` — Remover duplicação

- Remover import `useRealTimeProtection` (linha 16)
- Remover chamada `useRealTimeProtection()` (linha 49)

## 4. Nova migration SQL

### 4a. Adicionar coluna `finish_reason text` na tabela `auctions`

```sql
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS finish_reason text;
```

### 4b. Recriar `bot_protection_loop` com:

**Atomicidade em todos os UPDATEs**: adicionar `AND finished_at IS NULL` ao WHERE e usar `GET DIAGNOSTICS v_rows = ROW_COUNT` para confirmar que outra camada não finalizou primeiro.

**`finish_reason` em cada caminho de finalização:**
- `'time_limit'` — horário limite
- `'max_price'` — preço máximo
- `'revenue_target'` — meta de receita
- `'loss_protection'` — prejuízo evitado
- `'inactivity_forced'` — inatividade 60s+ (safety net)

**Novo bloco FINALIZAÇÃO POR INATIVIDADE (60s+)** inserido entre meta de receita e lance probabilístico:

```sql
-- SAFETY NET: FINALIZAÇÃO FORÇADA POR INATIVIDADE (60s+)
IF v_seconds_since_last_bid > 60 THEN
  SELECT public.get_random_bot() INTO v_bot_user_id;
  IF v_bot_user_id IS NOT NULL THEN
    -- Montar winner_name, last_bidders (mesmo padrão existente)
    ...
  END IF;

  UPDATE auctions SET 
    status = 'finished', 
    finished_at = v_current_time,
    winner_id = v_bot_user_id, 
    winner_name = v_winner_name,
    last_bidders = COALESCE(v_current_bidders, last_bidders),
    finish_reason = 'inactivity_forced'
  WHERE id = v_auction.id AND status = 'active' AND finished_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    RAISE LOG '🚨 [BOT-LOOP] Leilão "%" finalizado por INATIVIDADE (%s sem lance)', v_auction.title, v_seconds_since_last_bid;
  END IF;
  CONTINUE;
END IF;
```

Precisa declarar nova variável `v_rows integer;`.

Todos os UPDATEs existentes recebem o mesmo tratamento: `AND finished_at IS NULL`, `GET DIAGNOSTICS`, e `finish_reason`.

## 5. `supabase/functions/sync-timers-and-protection/index.ts`

### 5a. Atualizar `finalizeWithBot` para aceitar `finishReason` como parâmetro

```typescript
async function finalizeWithBot(
  supabase: any, auctionId: string, auctionTitle: string, 
  reason: string, finishReason: string
) {
  // ... (mesmo código existente para bot, winnerName, lastBidders)

  const { error, count } = await supabase
    .from('auctions')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
      winner_id: bot.user_id,
      winner_name: winnerName,
      last_bidders: currentBidders,
      finish_reason: finishReason
    })
    .eq('id', auctionId)
    .eq('status', 'active')
    .is('finished_at', null);
  // ...
}
```

### 5b. Atualizar todas as chamadas existentes com `finishReason`:

- Horário limite: `finalizeWithBot(supabase, id, title, 'horário limite', 'time_limit')`
- Preço máximo: `finalizeWithBot(supabase, id, title, 'preço máximo', 'max_price')`
- Meta atingida: `finalizeWithBot(supabase, id, title, 'meta atingida', 'revenue_target')`
- Prejuízo evitado: `finalizeWithBot(supabase, id, title, 'prejuízo evitado', 'loss_protection')`

### 5c. Novo bloco SAFETY NET (30s+) entre meta de receita e lance probabilístico:

```typescript
// SAFETY NET: Inatividade > 30s — finalizar com bot
if (secondsSinceLastBid > 30) {
  console.log(`🚨 [INATIVIDADE] "${auction.title}" - ${secondsSinceLastBid}s sem lance, finalizando com BOT`);
  const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'inatividade', 'inactivity_forced');
  if (finalized) {
    await distributeFuryVault(supabase, auction.id, auction.title);
    finalizedCount++;
  }
  continue;
}
```

### 5d. Atualizar summary com `safety_net_finalized` counter

## Padronização `finish_reason`

| Valor | Significado | Quem pode setar |
|-------|------------|-----------------|
| `time_limit` | Horário limite (ends_at) | SQL + Edge |
| `max_price` | Preço máximo atingido | SQL + Edge |
| `revenue_target` | Meta de receita atingida | SQL + Edge |
| `loss_protection` | Prejuízo evitado (price > market_value) | SQL + Edge |
| `inactivity_forced` | Inatividade prolongada (safety net) | SQL (60s) + Edge (30s) |

## Hierarquia de proteção

```text
Camada 1: Edge function (polling 10s) — threshold 30s → finish_reason = 'inactivity_forced'
Camada 2: SQL cron (1x por minuto)    — threshold 60s → finish_reason = 'inactivity_forced'
```

## Campos atualizados em TODA finalização (checagem de consistência)

| Campo | Valor |
|-------|-------|
| `status` | `'finished'` |
| `finished_at` | timestamp atual |
| `winner_id` | UUID do bot |
| `winner_name` | Nome formatado do bot (com cidade/estado) |
| `last_bidders` | Bot prepended ao topo, limitado a 3 |
| `finish_reason` | Um dos 5 valores padronizados |

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useRealTimeProtection.ts` | Remover guard admin, gate por user, intervalo 10s |
| `src/App.tsx` | Montar `useRealTimeProtection()` no AppContent |
| `src/pages/Index.tsx` | Remover import e chamada do hook |
| Nova migration SQL | Coluna `finish_reason`, safety net 60s, atomicidade com `AND finished_at IS NULL` + `GET DIAGNOSTICS` em todos os UPDATEs |
| `supabase/functions/sync-timers-and-protection/index.ts` | Safety net 30s, `finish_reason` em finalizações, filtro `.eq('status', 'active').is('finished_at', null)` |

