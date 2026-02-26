

# Ajustar timing dos bots para simular comportamento real

## Problema

Os thresholds de inatividade na `bot_protection_loop()` estão muito baixos:

```text
ATUAL (muito cedo):
  5-7s inatividade (timer ~10-8s) → 30% chance  ← usuário vê lance com 8-10s sobrando
  ≥ 8s inatividade (timer ~7s)    → 100%        ← usuário vê lance com 7s sobrando

COMPORTAMENTO REAL DE USUÁRIO:
  Espera até 1-3s no timer para dar lance (12-14s de inatividade)
```

## Solução

Alterar os thresholds na function `bot_protection_loop()` para que bots deem lances mais perto do timer zerar:

```text
NOVO (natural):
  < 10s inatividade (timer > 5s)    → 0% (ignora)
  10-12s inatividade (timer 5-3s)   → 20-30% chance (alguns bots "ansiosos")
  ≥ 13s inatividade (timer ~2s)     → 100% garantido (salva o leilão)
```

### Alteração: SQL migration para atualizar `bot_protection_loop()`

Linhas 97-103 da function mudam de:

```sql
IF v_seconds_since_last_bid >= 8 THEN
  v_bid_probability := 1.0;
ELSIF v_seconds_since_last_bid >= 5 THEN
  v_bid_probability := 0.3;
ELSE
  CONTINUE;
END IF;
```

Para:

```sql
IF v_seconds_since_last_bid >= 13 THEN
  v_bid_probability := 1.0;   -- timer ~2s, lance garantido
ELSIF v_seconds_since_last_bid >= 10 THEN
  v_bid_probability := 0.25;  -- timer ~5-3s, 25% chance
ELSE
  CONTINUE;                    -- timer > 5s, ignora
END IF;
```

### Também atualizar a edge function `sync-timers-and-protection`

A mesma lógica na edge function (linhas ~163-170) deve ser ajustada para manter consistência quando o admin hook a aciona:

```text
< 10s  → 0%
10-12s → 25%
≥ 13s  → 100%
```

### Resultado esperado

- Bots darão lances com **2-5 segundos restantes** no timer, simulando urgência real
- Usuários verão o timer chegar perto de zero, criando tensão e incentivando participação
- O leilão ainda será protegido (lance garantido a 2s restantes, nunca zera)

### Arquivos modificados

- **SQL migration**: atualiza a function `bot_protection_loop()` com novos thresholds
- **`supabase/functions/sync-timers-and-protection/index.ts`**: mesmos thresholds ajustados para consistência
- Nenhuma alteração de UI ou demais funcionalidades

