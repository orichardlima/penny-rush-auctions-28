

# Plano de Implementacao — Cofre Furia

## Resumo

Sistema de premio acumulativo vinculado a cada leilao ativo. O cofre cresce conforme lances sao dados, e ao final do leilao distribui o valor entre o maior participante e/ou um sorteio entre qualificados. O valor e creditado como saldo interno.

---

## Arquitetura do Banco de Dados

### Tabela 1: `fury_vault_config` (configuracao global/padrao)

| Coluna | Tipo | Default | Descricao |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| accumulation_type | text | 'fixed_per_x_bids' | 'fixed_per_x_bids' ou 'percentage' |
| accumulation_value | numeric | 0.20 | Valor fixo ou percentual |
| accumulation_interval | integer | 20 | A cada X lances (modo fixo) |
| default_initial_value | numeric | 0 | Valor inicial padrao |
| max_cap_type | text | 'absolute' | 'absolute' ou 'percentage_of_volume' |
| max_cap_value | numeric | 500 | Teto absoluto em R$ ou % |
| min_bids_to_qualify | integer | 15 | Minimo de lances para concorrer |
| recency_seconds | integer | 60 | Lance nos ultimos X segundos |
| distribution_mode | text | 'hybrid' | '100_raffle', '100_top', 'hybrid' |
| hybrid_top_percentage | numeric | 50 | % para maior participante (modo hibrido) |
| hybrid_raffle_percentage | numeric | 50 | % para sorteio (modo hibrido) |
| fury_mode_enabled | boolean | false | Ativar Modo Furia Final |
| fury_mode_seconds | integer | 120 | Ultimos X segundos |
| fury_mode_multiplier | numeric | 2 | Multiplicador de acumulo |
| is_active | boolean | true | Se o cofre esta ativo globalmente |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

RLS: Admins ALL, authenticated SELECT.

### Tabela 2: `fury_vault_instances` (cofre por leilao)

| Coluna | Tipo | Default | Descricao |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| auction_id | uuid | NOT NULL | FK para auctions |
| current_value | numeric | 0 | Valor acumulado atual |
| initial_value | numeric | 0 | Valor inicial definido |
| max_cap | numeric | 500 | Teto deste cofre |
| total_increments | integer | 0 | Quantas vezes incrementou |
| last_increment_at_bid | integer | 0 | Em qual lance foi o ultimo incremento |
| fury_mode_active | boolean | false | Se modo furia esta ativo agora |
| status | text | 'accumulating' | 'accumulating', 'distributing', 'completed' |
| top_bidder_user_id | uuid | NULL | Quem mais deu lances |
| top_bidder_amount | numeric | 0 | Valor do top bidder |
| raffle_winner_user_id | uuid | NULL | Ganhador do sorteio |
| raffle_winner_amount | numeric | 0 | Valor do sorteio |
| distributed_at | timestamptz | NULL | Quando foi distribuido |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

RLS: Admins ALL, anyone SELECT.

### Tabela 3: `fury_vault_logs` (historico de acumulo)

| Coluna | Tipo | Default | Descricao |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| vault_instance_id | uuid | NOT NULL | FK |
| event_type | text | NOT NULL | 'increment', 'fury_activated', 'distribution_top', 'distribution_raffle', 'cap_reached' |
| amount | numeric | 0 | Valor do evento |
| bid_number | integer | NULL | Numero do lance que disparou |
| details | jsonb | NULL | Dados extras (user_id do sorteio, etc) |
| created_at | timestamptz | now() | |

RLS: Admins ALL, anyone SELECT.

### Tabela 4: `fury_vault_qualifications` (usuarios qualificados)

| Coluna | Tipo | Default | Descricao |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| vault_instance_id | uuid | NOT NULL | FK |
| user_id | uuid | NOT NULL | |
| total_bids_in_auction | integer | 0 | |
| last_bid_at | timestamptz | NULL | |
| is_qualified | boolean | false | Atende min_bids + recency |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

RLS: Admins ALL, users own SELECT, anyone SELECT (count only via vault_instances).
UNIQUE constraint em (vault_instance_id, user_id).

### Tabela 5: `fury_vault_withdrawals` (saques de premios do cofre)

| Coluna | Tipo | Default | Descricao |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | |
| amount | numeric | NOT NULL | |
| status | text | 'pending' | 'pending', 'processing', 'completed', 'rejected' |
| source_vault_id | uuid | NOT NULL | De qual cofre veio |
| processed_at | timestamptz | NULL | |
| created_at | timestamptz | now() | |

RLS: Admins ALL, users own SELECT + INSERT.

---

## Logica de Backend

### Trigger 1: Acumulo automatico (na tabela `bids`)

Apos cada INSERT em `bids`:
1. Buscar vault_instance para o auction_id
2. Se nao existe ou status != 'accumulating', sair
3. Buscar config do cofre
4. Verificar se atingiu intervalo (total_bids % interval == 0)
5. Se sim e nao atingiu teto: incrementar current_value
6. Atualizar/inserir qualificacao do usuario em fury_vault_qualifications
7. Se Modo Furia ativo (ultimos X segundos antes de ends_at): aplicar multiplicador
8. Inserir log em fury_vault_logs

### Trigger/Funcao 2: Distribuicao (quando leilao finaliza)

Na edge function `sync-timers-and-protection` (onde leiloes sao finalizados), apos marcar status='finished':
1. Buscar vault_instance do leilao
2. Calcular qualificados (min_bids + lance nos ultimos Y segundos antes de finished_at)
3. Conforme distribution_mode:
   - `100_top`: creditar tudo ao maior participante qualificado
   - `100_raffle`: sortear entre qualificados
   - `hybrid`: dividir conforme percentuais configurados
4. Creditar valor em `profiles.bids_balance` (como credito interno)
5. Registrar em fury_vault_logs
6. Atualizar vault_instance com winners e status='completed'

### Sorteio auditavel

Usar funcao SQL `random()` com seed registrado, ou gerar indice aleatorio via `gen_random_uuid()` convertido a inteiro, registrando o calculo completo no log.

---

## Frontend

### 1. Componente `FuryVaultDisplay` (dentro do AuctionCard)

Exibido apenas quando ha vault_instance para o leilao:
- Icone de cofre com valor atual animado (R$ XX,XX)
- Barra de progresso ate o proximo incremento ("Faltam 7 lances!")
- Badge com numero de qualificados
- Indicador visual quando Modo Furia esta ativo (cor vermelha pulsante)

**Arquivo:** `src/components/FuryVaultDisplay.tsx`

### 2. Modificacao em `AuctionCard.tsx`

- Importar e renderizar `FuryVaultDisplay` abaixo dos dados de preco, acima do botao de lance
- Passar auction_id como prop
- Nenhuma outra alteracao no card

### 3. Hook `useFuryVault.ts`

- Query para buscar vault_instance por auction_id
- Subscription Realtime na tabela fury_vault_instances para atualizacoes em tempo real
- Calcular progresso ate proximo incremento
- Retornar: currentValue, nextIncrementIn, qualifiedCount, isFuryMode, isQualified (usuario atual)

### 4. Tela de Admin: Configuracao do Cofre

Novo tab ou secao em `SystemSettings.tsx` ou componente dedicado:
- Formulario para editar fury_vault_config
- Toggle on/off global
- Todos os campos configuraveis listados na tabela 1

### 5. Criacao automatica do vault_instance

Ao criar/ativar um leilao (no BatchAuctionGenerator ou manualmente), criar automaticamente um registro em fury_vault_instances com os valores da config global. O admin pode opcionalmente sobrescrever o valor inicial.

### 6. Secao de resultados do Cofre (pos-leilao)

No AuctionCard (status finished) ou AuctionDetailView:
- Mostrar valor final do cofre
- Nome do maior participante e valor recebido
- Nome do ganhador do sorteio e valor recebido

---

## Modulo de Saque (Secao 6 da especificacao)

### Configuracoes em `fury_vault_config`:
- `min_withdrawal_amount` (numeric, default 100)
- `max_monthly_withdrawal_pct` (numeric, default 50)
- `withdrawal_cooldown_days` (integer, default 30)
- `processing_days` (integer, default 3)
- `require_verified_account` (boolean, default true)

### Frontend:
- Secao no Dashboard do usuario mostrando saldo acumulado de premios do cofre
- Botao "Solicitar Saque" com validacoes client-side
- Historico de saques

### Backend:
- Saldo de premios do cofre armazenado em `profiles` (novo campo `fury_vault_balance`) ou calculado via SUM dos logs
- Validacoes server-side no INSERT da tabela de saques via RLS + trigger

---

## Estatisticas Futuras (estrutura preparada)

As tabelas de logs e instances ja permitem calcular:
- Recorde historico (MAX de current_value em vault_instances completed)
- Maior cofre da semana (filtro por data)
- Ranking de maiores ganhos (query em fury_vault_logs por distribution)

Nenhum componente visual sera criado agora, mas a estrutura de dados suporta.

---

## Arquivos criados/modificados

### Novos:
- `src/components/FuryVaultDisplay.tsx`
- `src/components/Admin/FuryVaultConfigManager.tsx`
- `src/hooks/useFuryVault.ts`
- 1 migration SQL (5 tabelas + trigger de acumulo + funcao de distribuicao + RLS)

### Modificados:
- `src/components/AuctionCard.tsx` — adicionar FuryVaultDisplay
- `supabase/functions/sync-timers-and-protection/index.ts` — chamar distribuicao ao finalizar leilao
- `src/components/Admin/BatchAuctionGenerator.tsx` — criar vault_instance ao gerar leiloes
- `src/components/SystemSettings.tsx` ou `src/components/AdminDashboard.tsx` — link para config do cofre

### NAO modificados:
- Nenhum outro componente, hook ou edge function existente

---

## Ordem de implementacao sugerida

1. Migration SQL (tabelas, trigger, funcoes, RLS, dados iniciais da config)
2. Hook `useFuryVault.ts`
3. Componente `FuryVaultDisplay.tsx`
4. Integracao no `AuctionCard.tsx`
5. Logica de distribuicao no `sync-timers-and-protection`
6. Criacao automatica no `BatchAuctionGenerator`
7. Tela admin `FuryVaultConfigManager.tsx`
8. Modulo de saque (tabela + UI)

