

# Detalhamento do que foi implantado -- Cofre Furia

## Banco de Dados (Migration SQL)

Foram criadas **5 tabelas** e **2 funções** no banco:

### Tabelas

| Tabela | Finalidade | RLS |
|---|---|---|
| `fury_vault_config` | Configuração global (tipo de acúmulo, intervalo, teto, modo fúria, distribuição, regras de saque) | Admins: ALL / Autenticados: SELECT |
| `fury_vault_instances` | Estado do cofre por leilão (valor atual, teto, status, vencedores) | Admins: ALL / Todos: SELECT |
| `fury_vault_logs` | Histórico de eventos (incrementos, distribuições, ativação do modo fúria) | Admins: ALL / Todos: SELECT |
| `fury_vault_qualifications` | Qualificação por usuário por cofre (total de lances, último lance, se qualificado) | Admins: ALL / Todos: SELECT |
| `fury_vault_withdrawals` | Saques de prêmios do cofre | Admins: ALL / Próprio usuário: SELECT + INSERT |

Uma **linha de configuração padrão** foi inserida automaticamente com os valores:
- Acúmulo: R$ 0,20 a cada 20 lances
- Teto: R$ 500 (absoluto)
- Qualificação: mínimo 15 lances + lance nos últimos 60 segundos
- Distribuição: híbrida 50/50 (top participante + sorteio)
- Modo Fúria: desativado (configurável para últimos 120s com multiplicador 2x)
- Saque: mínimo R$ 100, máx 50% mensal, cooldown 30 dias, 3 dias processamento

### Funções SQL

1. **`fury_vault_on_bid()`** -- Trigger AFTER INSERT na tabela `bids`
   - Busca o vault_instance do leilão
   - Conta total de lances do leilão
   - Verifica Modo Fúria (últimos X segundos antes de `ends_at`)
   - A cada X lances (módulo do intervalo), incrementa `current_value` respeitando o teto
   - Faz upsert na qualificação do usuário (contagem + timestamp)
   - Registra logs de incremento, ativação de fúria e teto atingido

2. **`fury_vault_distribute(p_auction_id)`** -- Chamada via RPC pela Edge Function
   - Atualiza qualificações com base em recência (lance nos últimos Y segundos antes de `finished_at`)
   - Conta qualificados; se zero, marca como completed sem distribuir
   - Encontra top participante qualificado (mais lances)
   - Calcula valores conforme modo de distribuição (100% top, 100% sorteio, ou híbrido)
   - Sorteio auditável: usa `md5(seed || user_id)` com seed de `gen_random_uuid()`
   - Credita valores em `profiles.bids_balance`
   - Registra tudo em `fury_vault_logs`
   - Atualiza instance com vencedores e status `completed`

### Realtime

- `fury_vault_instances` adicionada à publicação `supabase_realtime` para atualizações em tempo real no frontend.

---

## Frontend

### Hook: `src/hooks/useFuryVault.ts`
- Busca `fury_vault_instances` e `fury_vault_config` para um `auctionId`
- Busca contagem de qualificados e qualificação do usuário atual
- Subscription Realtime na tabela `fury_vault_instances` (atualiza valor do cofre em tempo real)
- Retorna: `currentValue`, `isFuryMode`, `qualifiedCount`, `isQualified`, `userBidsInAuction`, `hasVault`, `status`

### Componente: `src/components/FuryVaultDisplay.tsx`
- Exibido dentro do `AuctionCard` quando existe vault instance e config ativo
- **Leilão ativo**: mostra valor do cofre, barra de progresso até próximo incremento, contagem de qualificados, badge de qualificação do usuário, indicador visual de Modo Fúria (borda vermelha pulsante)
- **Leilão finalizado**: mostra valor final, prêmio do top participante e do sorteio

### Integração: `src/components/AuctionCard.tsx`
- `FuryVaultDisplay` renderizado abaixo dos dados de preço/lances e acima do botão de lance
- Recebe `auctionId`, `auctionStatus` e `totalBids` como props
- Nenhuma outra alteração no card

---

## Edge Function: `sync-timers-and-protection`

- Nova função auxiliar `distributeFuryVault()` adicionada
- Chama `supabase.rpc('fury_vault_distribute', { p_auction_id })` sempre que um leilão é finalizado (por timer, preço máximo ou meta de receita)
- Logs no console indicando sucesso/erro da distribuição

---

## Automação: `BatchAuctionGenerator.tsx`

- Após criar leilões em lote, busca a `fury_vault_config` ativa
- Se ativa, cria automaticamente um `fury_vault_instance` para cada leilão com `initial_value` e `max_cap` da config global

---

## Implantado nesta iteração

| Item | Status |
|---|---|
| Tela admin para editar `fury_vault_config` (`FuryVaultConfigManager`) | ✅ Implementado |
| Seção de saque no dashboard do usuário (`FuryVaultUserSection`) | ✅ Implementado |
| Estatísticas visuais (recorde, ranking) (`FuryVaultStats`) | ✅ Implementado |
| Campo `fury_vault_balance` em `profiles` (saldo dedicado) | Não criado; prêmios vão para `bids_balance`, saldo calculado via logs |

