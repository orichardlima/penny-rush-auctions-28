
# Plano — Loja Show (Fase 2)

Vitrine completa de resgate de Pontos Show, com carrinho, checkout usando endereço salvo no perfil e integração com as RPCs de resgate já existentes (`redeem_create`, `redeem_approve`, `redeem_reject`, `redeem_cancel`).

## Escopo confirmado
- Vitrine + página de produto + carrinho + checkout + confirmação.
- Endereço vem do perfil do usuário (coletado no cadastro).
- Acompanhamento detalhado de pedidos (`/meus-resgates`) fica para fase seguinte — nesta fase, apenas um toast de confirmação + link resumido no `/meus-pontos`.
- 3 direções visuais renderizadas para você escolher antes de eu construir a loja definitiva.

---

## Fase A — Direções visuais (antes de codar)

1. Capturo screenshot da atual `/loja-show` e do padrão visual do `/meus-pontos`.
2. Gero 3 direções distintas (mesma paleta/tipografia do Show de Lances travadas), variando composição:
   - **Vitrine editorial** — hero de produto em destaque, storytelling, arejado (combina com 3 SKUs iniciais).
   - **Marketplace premium** — grid denso, filtros por categoria/faixa de pontos, badges "Destaque"/"Estoque baixo".
   - **Boutique de recompensas** — cards grandes com foto 4:5, saldo de pontos sempre visível, foco em desejo.
3. Você escolhe uma direção e sigo para as fases B–D com composição travada.

---

## Fase B — Endereço no cadastro/perfil

Novos campos em `profiles` (nullable, sem quebrar cadastros antigos):
- `address_zip`, `address_street`, `address_number`, `address_complement`, `address_neighborhood`, `address_city`, `address_state`.

Ajustes de UI:
- `src/pages/Auth.tsx` (cadastro): novo bloco "Endereço para entrega de prêmios" com busca por CEP (ViaCEP público).
- `src/components/User/UserProfileEditor.tsx`: mesmos campos editáveis depois.
- `src/pages/CompleteProfile.tsx`: se logar sem endereço, pede antes de resgatar (guarda leve, não bloqueia navegação).

Sem migration destrutiva: campos novos, opcionais.

---

## Fase C — Loja Show (vitrine + carrinho + checkout)

Arquivos novos:
- `src/pages/LojaShow.tsx` — reescrita completa seguindo a direção escolhida (mantém a rota atual).
- `src/pages/ProdutoShow.tsx` — página de detalhe (`/loja-show/:slug`).
- `src/pages/CheckoutResgate.tsx` — revisão do carrinho + endereço + confirmação (`/loja-show/checkout`).
- `src/components/Loja/ProductCard.tsx`, `ProductGrid.tsx`, `CategoryFilter.tsx`, `PointsBadge.tsx`, `StockBadge.tsx`, `CartDrawer.tsx`, `CartSummary.tsx`, `EmptyStore.tsx`.
- `src/hooks/useStoreCatalog.ts` — lista `points_store_items` ativos + categorias + imagens extras.
- `src/hooks/useStoreCart.ts` — carrinho em `localStorage` com validação de saldo, limite por usuário e estoque.
- `src/hooks/useRedeemCheckout.ts` — chama `redeem_create` (RPC existente) montando `p_items`, `p_shipping` (snapshot do endereço do perfil) e `p_idem` (uuid do carrinho).

Fluxo do usuário:
1. Entra em `/loja-show` → vê saldo (Pontos Show), filtros por categoria e cards de produto.
2. Abre produto → galeria, descrição, custo em pontos, botão "Adicionar" (ou "Resgatar agora").
3. Ícone de carrinho no header da loja mostra itens; drawer permite ajustar quantidade.
4. Em `/loja-show/checkout`:
   - Mostra endereço do perfil (com CTA "Editar" que leva ao perfil).
   - Revisa itens, total de pontos, saldo após resgate.
   - Se faltar saldo/estoque/endereço → CTA bloqueado com mensagem clara.
   - Confirmar → chama `redeem_create` → toast de sucesso + limpa carrinho + redireciona para `/meus-pontos` (que passa a mostrar bloco "Últimos resgates").
5. Cancelamento pendente disponível via botão no toast/histórico (chama `redeem_cancel`).

Regras respeitadas (já no schema):
- `store_visible_for(auth.uid())` como guard da rota.
- Reserva de estoque e pontos é atômica na RPC — front só reflete resultado.

---

## Fase D — Integração com `/meus-pontos`

- Novo bloco compacto "Meus resgates recentes" listando os últimos 3 pedidos com status (PENDING / APPROVED / REJECTED / CANCELLED) via `points_redemptions` + `points_redemption_items`.
- Link "Ver todos" fica desabilitado com tooltip "Em breve" (página `/meus-resgates` completa fica para próxima fase, conforme sua decisão).

---

## Detalhes técnicos

- **Migrations necessárias:**
  1. `ALTER TABLE profiles` — adicionar 7 campos de endereço, todos nullable.
  2. GRANT já ok para `profiles`; sem novas tabelas.
- **Sem novas edge functions** — todo o fluxo usa RPCs já existentes (`redeem_create`, `redeem_cancel`, `store_visible_for`).
- **Design tokens** — nada de cores hardcoded; extensões de token só se a direção escolhida exigir (definidas em `index.css` / `tailwind.config.ts`).
- **SEO** — `SEOHead` na loja e no produto (title + description + canonical).
- **Acessibilidade** — cards com `aria-label`, contraste checado, foco visível no drawer do carrinho.
- **Não mexo em:** nada do sistema de lances, bots, afiliados, parceiros, financeiro, header global (fora adicionar link "Loja Show" no menu do usuário, que já existe).

---

## Ordem de execução
1. Capturar screenshots e gerar as 3 direções → você escolhe.
2. Migration de endereço no perfil + UI de cadastro/perfil.
3. Loja + carrinho + checkout na direção escolhida.
4. Bloco de resgates recentes em `/meus-pontos`.
5. QA: fluxo completo em Playwright (login → adicionar → checkout → confirmar → ver em /meus-pontos → cancelar).
