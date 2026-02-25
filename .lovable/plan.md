

# Plano de Implementacao -- Ajustes Estrategicos do Cofre Furia

## Escopo Total

7 mudancas organizadas em 3 categorias: banco de dados, backend SQL, e frontend.

---

## 1. Migration SQL (uma unica migration)

### 1.1 Novo campo `config_snapshot` em `fury_vault_instances`

```sql
ALTER TABLE fury_vault_instances
  ADD COLUMN config_snapshot jsonb NULL;
```

Armazena uma copia congelada da `fury_vault_config` no momento da criacao do leilao. O trigger e o RPC passam a ler daqui em vez da tabela global.

### 1.2 Novo campo `max_cap_absolute` em `fury_vault_config`

```sql
ALTER TABLE fury_vault_config
  ADD COLUMN max_cap_absolute numeric NOT NULL DEFAULT 50;
```

Teto de seguranca absoluto. Quando `max_cap_type = 'percentage_of_volume'`, o sistema calcula o teto percentual e aplica `LEAST(percentual_calculado, max_cap_absolute)`. Quando `max_cap_type = 'absolute'`, usa `max_cap_value` direto (o campo `max_cap_absolute` fica como backup).

### 1.3 Atualizar preset inicial da config existente

```sql
UPDATE fury_vault_config SET
  accumulation_type = 'fixed_per_x_bids',
  accumulation_value = 0.20,
  accumulation_interval = 20,
  default_initial_value = 0,
  max_cap_type = 'percentage_of_volume',
  max_cap_value = 6,
  max_cap_absolute = 50,
  min_bids_to_qualify = 15,
  recency_seconds = 60,
  distribution_mode = 'hybrid',
  hybrid_top_percentage = 50,
  hybrid_raffle_percentage = 50,
  fury_mode_enabled = true,
  fury_mode_seconds = 120,
  fury_mode_multiplier = 2
WHERE is_active = true;
```

### 1.4 Recriar `fury_vault_on_bid()` -- Ler do snapshot + modo percentual + teto duplo

Mudancas na funcao trigger:

- Em vez de `SELECT * FROM fury_vault_config`, ler `v_instance.config_snapshot` e parsear os campos.
- Adicionar bloco `ELSIF accumulation_type = 'percentage'` que calcula `v_increment := (NEW.cost_paid * snapshot.accumulation_value / 100) * v_multiplier`.
- Para o cap: calcular `effective_cap` como `LEAST(snapshot.max_cap_value_calculated, snapshot.max_cap_absolute)`.
- Na qualificacao do usuario, ler `min_bids_to_qualify` do snapshot.

### 1.5 Recriar `fury_vault_distribute()` -- Ler do snapshot + desempate deterministico + auditoria enriquecida

Mudancas na funcao RPC:

- Ler config do `config_snapshot` do instance em vez da tabela global.
- Desempate do top participante: `ORDER BY total_bids_in_auction DESC, last_bid_at DESC, user_id ASC` (mais lances > lance mais recente > user_id menor como tiebreaker deterministico).
- Nos logs de distribuicao, incluir `user_name` (JOIN com profiles.full_name) e `auction_title` (do v_auction.title) no campo `details`.
- Adicionar log `distribution_summary` com o calculo completo da divisao.

### 1.6 Anti-abuso de saque -- Validacao reforçada via trigger

Criar trigger `BEFORE INSERT` na tabela `fury_vault_withdrawals` que valida:

1. **Conta bloqueada**: rejeita se `profiles.is_blocked = true`.
2. **CPF obrigatorio**: rejeita se `profiles.cpf IS NULL`.
3. **Chave PIX unica**: verifica se outra conta com mesmo CPF ja tem saques pendentes/processados (previne multiplas contas).
4. **Saque minimo**: compara com `config_snapshot` ou `fury_vault_config`.
5. **Cooldown**: verifica se ja existe saque do mesmo usuario nos ultimos X dias.
6. **Limite mensal**: calcula percentual sacado no mes corrente vs total ganho.

Isso garante validacao server-side que nao pode ser burlada pelo frontend.

---

## 2. Frontend -- Mudancas

### 2.1 `FuryVaultDisplay.tsx` -- UX aprimorada

- Mostrar "Faltam **X** lances para proximo incremento" (ja existe parcialmente, refinar calculo usando `totalBids` e `config.accumulation_interval`).
- Exibir status de qualificacao com detalhe: "X/15 lances" + badge "Qualificado" ou "Faltam Y lances".
- Adicionar countdown de recency: quando o leilao tem `ends_at`, mostrar "Lance nos ultimos 60s para manter qualificacao" com indicador visual.
- Valor do cofre exibido com 2 casas decimais (R$ XX,XX) -- ja esta assim, manter.

### 2.2 `FuryVaultConfigManager.tsx` -- Campo teto absoluto + aviso

- Adicionar campo "Teto absoluto de seguranca (R$)" (`max_cap_absolute`) que aparece sempre (independente do tipo de teto).
- Exibir nota explicativa: "O sistema sempre aplica o menor entre o teto configurado e o teto absoluto."
- Ao salvar, consultar se existem `fury_vault_instances` com `status = 'accumulating'`. Se sim, exibir alerta: "Existem X leiloes ativos. Alteracoes so afetam leiloes futuros."
- Adicionar interface do `VaultConfig` o campo `max_cap_absolute`.

### 2.3 `BatchAuctionGenerator.tsx` -- Gravar snapshot

Ao criar vault instances, buscar a config completa (todos os campos) e gravar como `config_snapshot` jsonb no insert:

```typescript
const vaultInstances = data.map((auction) => ({
  auction_id: auction.id,
  initial_value: vaultConfig.default_initial_value || 0,
  current_value: vaultConfig.default_initial_value || 0,
  max_cap: effectiveCap, // LEAST dos dois tetos
  config_snapshot: vaultConfig, // copia completa
}));
```

### 2.4 `FuryVaultUserSection.tsx` -- Validacao anti-abuso no modal de saque

- Antes de permitir saque, validar client-side: CPF preenchido, conta nao bloqueada.
- Mostrar mensagem clara se bloqueado: "Complete seu cadastro (CPF) para solicitar saques."
- Validar cooldown client-side (ultima solicitacao vs dias configurados).
- O trigger SQL garante a validacao server-side como camada final.

### 2.5 `useFuryVault.ts` -- Retornar `bidsUntilNextIncrement` correto

Corrigir calculo de `bidsUntilNextIncrement` usando `totalBids` (que vem do AuctionCard) em vez de estimar do `last_increment_at_bid`. Adicionar campo `recencySeconds` do config para o countdown de recency.

---

## 3. Nenhuma alteracao em

- `FuryVaultStats.tsx` (sem mudanca)
- Edge Function `sync-timers-and-protection` (sem mudanca, ja chama o RPC que sera atualizado)
- Nenhuma outra tela/componente existente

---

## Resumo das alteracoes por arquivo

| Arquivo | Tipo | Descricao |
|---|---|---|
| Migration SQL | DB | 6 operacoes: add columns, update preset, recriar 2 funcoes, criar trigger anti-abuso |
| `BatchAuctionGenerator.tsx` | Frontend | Gravar config_snapshot ao criar vaults |
| `FuryVaultConfigManager.tsx` | Frontend | Campo max_cap_absolute + aviso leiloes ativos |
| `FuryVaultDisplay.tsx` | Frontend | "Faltam X lances", countdown recency, status qualificacao |
| `FuryVaultUserSection.tsx` | Frontend | Validacao anti-abuso no modal de saque |
| `useFuryVault.ts` | Frontend | Corrigir bidsUntilNextIncrement + recencySeconds |

---

## Secao Tecnica -- Detalhes de Implementacao

### Trigger anti-abuso (`validate_fury_vault_withdrawal`)

```text
BEFORE INSERT ON fury_vault_withdrawals
FOR EACH ROW:
  1. SELECT is_blocked, cpf FROM profiles WHERE user_id = NEW.user_id
  2. IF is_blocked → RAISE EXCEPTION 'Conta bloqueada'
  3. IF cpf IS NULL → RAISE EXCEPTION 'CPF obrigatorio'
  4. SELECT COUNT(*) FROM fury_vault_withdrawals
     WHERE user_id != NEW.user_id
     AND status IN ('pending','processing','completed')
     AND user_id IN (SELECT user_id FROM profiles WHERE cpf = v_cpf)
     → Se > 0 → RAISE EXCEPTION 'CPF ja utilizado em outra conta'
  5. SELECT MAX(created_at) FROM fury_vault_withdrawals
     WHERE user_id = NEW.user_id AND status != 'rejected'
     → Se dentro do cooldown → RAISE EXCEPTION
  6. Calcular total sacado no mes / total ganho
     → Se excede max_monthly_withdrawal_pct → RAISE EXCEPTION
```

### Desempate Top Participante

```sql
ORDER BY total_bids_in_auction DESC,  -- mais lances primeiro
         last_bid_at DESC,             -- lance mais recente primeiro
         user_id ASC                   -- deterministico por UUID
LIMIT 1;
```

### Snapshot -- Campos congelados

O `config_snapshot` jsonb contera todos os campos da `fury_vault_config` no momento da criacao. Os campos relevantes lidos pelo trigger: `accumulation_type`, `accumulation_value`, `accumulation_interval`, `max_cap_value`, `max_cap_absolute`, `max_cap_type`, `min_bids_to_qualify`, `recency_seconds`, `fury_mode_enabled`, `fury_mode_seconds`, `fury_mode_multiplier`, `distribution_mode`, `hybrid_top_percentage`, `hybrid_raffle_percentage`.

