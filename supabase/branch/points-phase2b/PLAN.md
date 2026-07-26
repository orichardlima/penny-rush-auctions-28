# Fase 2B — Loja e Resgates (revisado)

Branch-only. Depende da Fase 2A já aplicada em produção.

## Rota
`/loja-show` para usuários. `/admin/pontos-loja` estendido com abas:
Produtos, Categorias, Imagens, Estoque, Pedidos, Ajustes, Relatórios,
Auditoria, Feature flags.

## Regras confirmadas
- `points_plus_pix_enabled=false` no MVP — schema preparado, sem cobrança PIX.
- Aprovação manual obrigatória durante o piloto (PENDING → APPROVED/REJECTED).
- `points_expiration_enabled=false` — colunas `expires_at` existem, sem cron.
- Visibilidade da loja segue audiência do Programa Pontos Show (off / admin_only /
  pilot / percent / all). Status de parceiro/plano/binário/contrato **não**
  restringe.

## Tabelas
- `points_store_categories`
- `points_store_items` (nome, slug, descrição curta/completa, categoria, marca,
  modelo, sku, imagem principal, custo_pontos, custo_reais_interno,
  valor_referencia, estoque_total, estoque_reservado, estoque_disponivel [gerada],
  estoque_minimo, limite_por_usuario, tipo (`PHYSICAL|DIGITAL`), status
  (`DRAFT|ACTIVE|PAUSED|OUT_OF_STOCK|ARCHIVED`), destaque, prazo_estimado_dias,
  frete_gratis, peso_g, dimensoes jsonb, fornecedor, sob_encomenda, inicio_em,
  fim_em, timestamps).
- `points_store_item_images` (item_id, url, ordem, alt).
- `points_store_item_price_history` (item_id, old_points, new_points, admin_id,
  reason, created_at) — trigger `AFTER UPDATE OF cost_points`.
- `points_store_inventory_movements` — enum
  `ENTRY|RESERVE|RELEASE|REDEMPTION|ADJUSTMENT|LOSS|DAMAGE|RETURN|CANCELLATION`
  com `quantity_delta`, `stock_before`, `stock_after`, `redemption_id`,
  `admin_id`, `reason`.
- `points_redemptions` — order_number, status
  (`PENDING|APPROVED|REJECTED|SEPARATING|SHIPPED|DELIVERED|CANCELLED|REVERSED`),
  total_points, shipping_address_snapshot jsonb, shipping_method, shipping_cost,
  tracking_code, carrier, admin_notes, approved_by, timestamps.
- `points_redemption_items` — item_snapshot jsonb, quantity, points_unit,
  points_total, internal_cost_snapshot.
- `points_redemption_status_history` — old_status, new_status, actor, reason.

## RPCs
- `redeem_create(p_items jsonb, p_shipping jsonb, p_idem text)` — valida
  audiência, saldo, estoque, limites; cria PENDING; chama `points_reserve`
  e movimenta `RESERVE` de estoque.
- `redeem_approve(p_redemption uuid, p_admin uuid, p_notes text)` — chama
  `points_confirm_reservation`, gera `REDEMPTION` de estoque, status APPROVED.
- `redeem_reject(p_redemption uuid, p_admin uuid, p_reason text)` — libera
  pontos (`points_release_reservation`) e estoque (`RELEASE`), status REJECTED.
- `redeem_cancel(p_redemption uuid, p_reason text)` — usuário só cancela
  se PENDING; mesma liberação de reject.
- `redeem_mark_shipped(...)`, `redeem_mark_delivered(...)`.
- `store_visible_for(p_user uuid) returns boolean` — audiência.

Todas SECURITY DEFINER, `search_path = public`, idempotentes por `p_idem`.

## Snapshots exigidos
- `item_snapshot` em `points_redemption_items` congela o item na hora da compra.
- `shipping_address_snapshot` congela endereço; alterações em profile não
  afetam pedidos existentes.
- `points_store_item_price_history` audita alterações de preço; pedidos
  existentes mantêm o preço salvo em `points_total`.

## Flags (permanecem false)
```
points_store_enabled=false
points_redemption_enabled=false
points_plus_pix_enabled=false
```
`redeem_create` valida `points_store_enabled AND points_redemption_enabled` e
rejeita com `store_disabled` quando desligado.

## Frontend
- `/loja-show` — grid de itens, gate por `store_visible_for`, checkout
  com resumo, endereço, confirmação. `PontosPixToggle` escondido enquanto flag off.
- `/admin/pontos-loja` — novas abas listadas acima. Aprovar/rejeitar chama RPCs.

## Entregáveis
- `002b_points_store_up.sql`
- `002b_points_store_down.sql`
- `points_phase2b_test.ts`
