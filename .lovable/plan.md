

## Bonus de Inicio Rapido (Fast Start Bonus) - Opcao A (Retroativo)

### Resumo
Criar um sistema de bonus de inicio rapido que aumenta automaticamente a porcentagem de indicacao para parceiros que atingem metas de indicacoes diretas nos primeiros 30 dias. Ao atingir uma faixa, todos os bonus de indicacao de nivel 1 do periodo sao recalculados retroativamente com o novo percentual, gerando creditos complementares.

### Regras de Negocio

- A janela de tempo comeca na data de criacao do contrato do parceiro (`partner_contracts.created_at`) e dura 30 dias
- Conta apenas indicacoes diretas (nivel 1) com status diferente de CANCELLED
- Faixas configuráveis pelo admin (exemplo padrao):
  - **Acelerador**: 3 indicacoes -> +2% extra
  - **Turbo**: 5 indicacoes -> +4% extra
  - **Foguete**: 10 indicacoes -> +6% extra
- Ao atingir uma faixa, calcula-se a diferenca entre o bonus ja pago/pendente e o novo valor para cada indicacao do periodo, e cria-se registros complementares em `partner_referral_bonuses`
- Apenas a maior faixa atingida e aplicada (nao acumula)
- O bonus extra e registrado como novo registro em `partner_referral_bonuses` com um campo identificador (`is_fast_start_bonus = true`)

---

### Etapa 1: Banco de Dados

**Nova tabela: `fast_start_tiers`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| name | text | Nome da faixa (Acelerador, Turbo, Foguete) |
| required_referrals | integer | Qtd minima de indicacoes |
| extra_percentage | numeric | Porcentagem extra sobre o aporte |
| is_active | boolean | Se esta ativa |
| sort_order | integer | Ordenacao |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

RLS: Admins podem gerenciar; qualquer autenticado pode visualizar.

**Nova tabela: `fast_start_achievements`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| partner_contract_id | uuid | Contrato do parceiro |
| tier_id | uuid FK | Faixa atingida |
| referrals_count | integer | Qtd de indicacoes no momento |
| extra_percentage_applied | numeric | % extra aplicado |
| total_extra_bonus | numeric | Total de bonus extra distribuido |
| achieved_at | timestamptz | Data em que atingiu |
| processed | boolean | Se ja foi processado (creditos criados) |
| created_at | timestamptz | Criacao |

RLS: Admins podem gerenciar; usuarios veem seus proprios.

**Nova coluna em `partner_referral_bonuses`:**
- `is_fast_start_bonus` boolean DEFAULT false - identifica bonus complementares do fast start

**Nova funcao SQL: `process_fast_start_bonus(p_contract_id uuid, p_tier_id uuid)`**
- Busca todos os bonus de nivel 1 do contrato dentro dos primeiros 30 dias
- Calcula a diferenca entre a porcentagem original e a nova (original + extra)
- Insere registros complementares em `partner_referral_bonuses` com `is_fast_start_bonus = true`
- Registra em `fast_start_achievements`

**Nova funcao SQL: `check_fast_start_eligibility()`** (trigger)
- Disparada apos INSERT em `partner_referral_bonuses` (nivel 1)
- Verifica se o indicador esta dentro da janela de 30 dias
- Conta indicacoes diretas e verifica se atingiu nova faixa
- Se sim, chama `process_fast_start_bonus`

---

### Etapa 2: Interface Admin

**Novo componente: `FastStartTiersManager.tsx`**
- Tabela com as faixas configuradas (nome, qtd indicacoes, % extra, status)
- Edicao inline de porcentagens e quantidades
- Toggle ativar/desativar faixas
- Integrado como nova aba na pagina de admin de parceiros

**Novo hook: `useFastStartTiers.ts`**
- CRUD para a tabela `fast_start_tiers`

---

### Etapa 3: Dashboard do Parceiro

**Novo componente: `FastStartProgress.tsx`**
- Exibido na `PartnerReferralSection` apenas durante os primeiros 30 dias
- Mostra:
  - Countdown do prazo restante (dias/horas)
  - Barra de progresso para a proxima faixa
  - Faixas ja atingidas (com check verde)
  - Proxima meta (ex: "Mais 2 indicacoes para Turbo!")
  - Valor estimado do bonus extra

**Novo hook: `useFastStartProgress.ts`**
- Busca faixas ativas, conta indicacoes diretas no periodo, calcula progresso
- Verifica se o contrato ainda esta na janela de 30 dias

---

### Etapa 4: Integracao com Historico

- No historico de indicacoes (`PartnerReferralSection`), bonus de fast start exibem badge especial "Bonus Rapido"
- Admins veem uma coluna extra no gerenciamento de parceiros mostrando se o parceiro atingiu alguma faixa

---

### Sequencia de Implementacao

1. Migracoes SQL (tabelas, funcoes, trigger, dados iniciais)
2. Hook `useFastStartTiers` + componente admin `FastStartTiersManager`
3. Hook `useFastStartProgress` + componente parceiro `FastStartProgress`
4. Integracao na `PartnerReferralSection` e no historico
5. Testes

