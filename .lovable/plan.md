

## Plano: Corrigir lógica de finalização — proteger contra usuário real vencer sem receita

### Regra de negócio corrigida

- **Bots podem e devem vencer leilões** — isso é normal e esperado
- **Usuários reais NÃO podem vencer** se `company_revenue < revenue_target`
- Se o leilão precisa finalizar (por `ends_at`, `max_price`, etc.) e a receita está abaixo da meta, o **bot deve ser o vencedor**, não o usuário real

### Alterações

#### 1. Migration SQL — `bot_protection_loop`

Corrigir a lógica de finalização por `ends_at`:

- **Antes**: finaliza com o último bidder (qualquer um), independente da receita
- **Depois**: quando `ends_at` é atingido E `company_revenue < revenue_target`:
  - Verificar se o último lance é de um usuário real (`cost_paid > 0`)
  - Se sim, inserir um lance de bot antes de finalizar, fazendo o **bot vencer**
  - Se o último já é bot, finalizar normalmente com o bot como vencedor
- Quando `company_revenue >= revenue_target`: finalizar normalmente com qualquer vencedor (bot ou user)

Mesma lógica para finalização por `max_price`: se receita insuficiente, garantir bot como vencedor.

#### 2. `useRecentWinners.ts` — Filtrar bots da exibição pública

- Após buscar os `winner_id` dos leilões finalizados, cruzar com `profiles` e excluir os que têm `is_bot = true`
- Página pública de vencedores mostra apenas ganhadores humanos reais

#### 3. `useFinishAuction.ts` — Aplicar mesma proteção no encerramento manual

- Quando admin finaliza manualmente, verificar se `company_revenue < revenue_target`
- Se sim e o último lance é de usuário real, inserir bot bid antes e finalizar com bot

### Resumo do impacto

- Empresa nunca entrega produto com prejuízo a um usuário real
- Bots vencem normalmente quando a receita não foi atingida (comportamento esperado)
- Página pública só mostra vencedores humanos
- Admin mantém capacidade de finalizar manualmente com a mesma proteção

