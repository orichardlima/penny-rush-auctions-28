# Diagnóstico: a Loja Show está completa?

Resposta curta: o núcleo funciona (catálogo, carrinho, checkout, reserva de pontos, aprovação/rejeição admin), mas **falta a etapa pós-aprovação e a parte visual dos produtos**.

## O que já está pronto e ativo
- Catálogo `/loja-show` com gate de audiência (`store_visible_for`), página de produto, carrinho e checkout (`redeem_create`).
- RPCs em produção: `redeem_create`, `redeem_approve`, `redeem_reject`, `redeem_cancel`.
- Admin `/admin/pontos-loja` com abas Config, Regras, Categorias, Produtos, Pedidos (aprovar/rejeitar).
- 3 produtos ATIVOS com estoque: Fone (150), Caixa de Som (300), PS5 Slim (1.000).
- Página `/meus-resgates` com status e cancelamento pelo usuário.

## Lacunas confirmadas
1. **Sem imagens**: os 3 produtos estão com `main_image_url` nulo — por isso a loja exibe "SEM IMAGEM". A tabela `points_store_item_images` existe mas está vazia e não é usada por nenhuma tela.
2. **Admin só aceita URL de imagem** — não há upload; nenhum bucket de storage ligado à loja.
3. **Nenhuma categoria cadastrada** (0 registros), então o filtro por categoria da loja fica vazio.
4. **Fluxo logístico incompleto**: não existem as funções `redeem_mark_shipped` / `redeem_mark_delivered`. Depois de APPROVED o pedido não avança; não há campo de rastreio/transportadora na interface.
5. **Sem notificações** ao usuário quando o resgate é aprovado, rejeitado ou enviado.
6. **Zero pedidos até hoje** — o fluxo completo ainda não foi validado ponta a ponta em produção.

## Proposta de conclusão (em 3 blocos)

### Bloco 1 — Visual do produto (impacto imediato)
- Upload de imagens no admin (bucket público `store-items`), com imagem principal + galeria em `points_store_item_images`.
- Galeria na página do produto e imagem no card da loja.
- Cadastrar categorias iniciais e vincular os 3 produtos.

### Bloco 2 — Logística do resgate
- RPCs `redeem_mark_shipped(rastreio, transportadora)` e `redeem_mark_delivered`, com registro em `points_redemption_status_history`.
- Aba Pedidos do admin: avançar status, informar rastreio, ver endereço do snapshot e itens do pedido.
- `/meus-resgates`: linha do tempo do status e código de rastreio visível.

### Bloco 3 — Comunicação e validação
- Notificação in-app em cada mudança de status (aprovado, rejeitado, enviado, entregue).
- Teste ponta a ponta com um resgate real de baixo custo para validar reserva, baixa de estoque e movimentos de inventário.

## Notas técnicas
- Nada de estrutura nova de tabela é necessário além de campos de rastreio já previstos em `points_redemptions`.
- As novas RPCs seguem o padrão existente: `SECURITY DEFINER`, `search_path = public`, guarda de admin.
- Nenhuma alteração em regras de pontuação, acúmulo ou flags do programa.
