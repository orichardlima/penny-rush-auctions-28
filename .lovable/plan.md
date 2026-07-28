
## Situação atual

Hoje o usuário comum **não tem uma tela dedicada** para acompanhar os Pontos Show. As únicas informações existentes estão:

- Em `/loja-show`: um cartão pequeno no canto superior mostra apenas `available_points`. Não mostra progresso do bucket (ex: "5 de 12 lances para o próximo ponto"), nem histórico, nem de qual leilão veio.
- `/meus-resgates`: mostra só resgates feitos, nada sobre acúmulo.
- **Não há link no `Header` nem no `UserDashboard`** apontando para nenhuma das duas. O usuário precisa saber a URL.

Dados já disponíveis no banco (não precisa migration):
- `points_wallets`: `available_points`, `reserved_points`, `lifetime_earned`, `lifetime_redeemed`.
- `points_accrual_buckets`: `eligible_bids_remaining` — o resto de lances que ainda não fechou 1 ponto (o "5/12").
- `points_ledger`: histórico com `transaction_type` (EARN_AUCTION, CONFIRM_REDEMPTION, EXPIRATION, ...), `points_delta`, `auction_id`, `created_at`, `reason`.
- `points_rules` (regra ativa 12:1) para exibir a proporção corretamente.

## O que será entregue

### 1. Nova rota `/meus-pontos` — página "Meus Pontos Show"

Estrutura da página, de cima para baixo:

**a) Cabeçalho didático**
- Título: "Meus Pontos Show".
- Frase explicativa curta: "Você ganha 1 Ponto Show a cada 12 lances pagos usados em leilões que você **não venceu**."

**b) Cartão de saldo (destaque)**
- Número grande: `available_points`.
- Linhas menores: "Total acumulado desde o início" (`lifetime_earned`) e "Já trocados" (`lifetime_redeemed`).
- Botão "Ir para a Loja Show" → `/loja-show`.

**c) Cartão "Progresso do próximo ponto"**
- Lê `points_accrual_buckets.eligible_bids_remaining` e a regra ativa (ex.: 12).
- Mostra: "Faltam X lances elegíveis para ganhar seu próximo ponto".
- Barra de progresso (`eligible_bids_remaining / 12`).
- Texto de apoio: "Somente lances **pagos** consumidos em leilões que você **não venceu** contam. Lances gratuitos, bônus e vitórias não geram pontos."

**d) Histórico de movimentações**
- Lista das últimas 30 linhas de `points_ledger` do usuário.
- Cada linha traduzida para português com ícone e cor:
  - `EARN_AUCTION` → "+N pts — leilão [título]" (join leve com `auctions.title` quando `auction_id` existir).
  - `RESERVE_REDEMPTION` / `CONFIRM_REDEMPTION` → "−N pts — resgate na Loja".
  - `RELEASE_REDEMPTION` → "Devolução de resgate".
  - `EXPIRATION` → "Expiração de pontos".
  - `ADMIN_CREDIT` / `ADMIN_DEBIT` → "Ajuste da equipe".
- Data relativa ("há 2 h") + saldo depois (`available_after`) em cinza.
- Estado vazio amigável: "Você ainda não gerou pontos. Compre lances e participe de leilões para começar."

**e) Bloco "Como funciona" (colapsável, aberto por padrão na 1ª visita)**
- Três passos curtos: "1. Compre lances pagos", "2. Dê lances em leilões", "3. Se não vencer, cada 12 lances pagos = 1 Ponto Show".
- Link "Ver regulamento" (aponta pra `/faq` âncora pontos — só o link, sem alterar o FAQ agora).

### 2. Acesso visível ao menu

- **Header (desktop e mobile):** adicionar item "Pontos Show" com badge do saldo atual (ex.: `1.947 pts`) ao lado do sino de notificações, entre "Leilões" e o avatar. No mobile, entra no menu hamburguer.
- **`UserDashboard`:** adicionar um card resumo "Pontos Show" ao lado dos cards existentes de saldo de lances, com botão "Acompanhar" → `/meus-pontos`.
- **`/loja-show`:** o cartão de saldo passa a ter um segundo link "Ver histórico e progresso →" apontando para `/meus-pontos`.

### 3. Comportamento quando o programa está desativado para o usuário

- Se `store_visible_for(user)` = false **e** a carteira estiver vazia (`available_points=0` e `lifetime_earned=0`), a página mostra o mesmo alerta amigável usado hoje na Loja: "O Programa Pontos Show ainda não está disponível para o seu perfil".
- Se o usuário já tem lifetime_earned > 0, a página abre normalmente mesmo com loja desabilitada — histórico é sempre visível.

## Fora do escopo desta entrega

- Nenhuma mudança em RPCs, triggers, regras de acúmulo, webhooks ou tabelas.
- Nenhuma mudança na Loja Show em si (catálogo, resgates, admin).
- Sem notificação push/email de "você ganhou 1 ponto" — pode ser fase seguinte.

## Detalhes técnicos (para referência)

- Arquivos novos: `src/pages/MeusPontos.tsx`, `src/hooks/usePointsWallet.ts`, `src/hooks/usePointsLedger.ts`, `src/components/Points/PointsProgressCard.tsx`, `src/components/Points/PointsHistoryList.tsx`.
- Arquivos editados: `src/App.tsx` (rota `/meus-pontos` com `lazyWithRetry`), `src/components/Header.tsx` (item de menu + badge), `src/components/UserDashboard.tsx` (card resumo), `src/pages/LojaShow.tsx` (segundo link no cartão de saldo).
- Todos os selects são RLS-safe: `points_wallets`, `points_accrual_buckets`, `points_ledger` já têm policies por `user_id = auth.uid()`.
- Sem novas policies, sem novas migrations.
