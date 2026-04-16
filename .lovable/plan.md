
## Plano: Investigar e corrigir comissões pendentes da Juciene

### Diagnóstico
- 2 compras PIX de R$ 15 cada (16/04 13:10) ainda em `payment_status = 'pending'`
- 2 comissões de R$ 7,50 (50%) criadas para o afiliado warlley silva, mas em status `pending` (não aprovadas)
- Segunda compra incorretamente marcada como "1ª Compra" em vez de "Recompra"
- Vínculo afiliado-indicado existe via `direct_signup` (não via link `?ref=`)

### Etapas

**1. Verificar logs do gateway de pagamento (PIX)**
- Consultar `analytics_query` em `function_edge_logs` para `asaas-webhook`, `mercado-pago-webhook`, `magen-webhook`, `veopag-webhook` filtrando pelos `purchase_id` ou `external_reference` das duas compras.
- Determinar se o pagamento foi confirmado pelo provedor mas o webhook falhou, ou se o cliente realmente nunca pagou.

**2. Apresentar opções ao usuário (admin)**
Após investigação dos logs, oferecer 3 cenários:
- **A)** Pagamento confirmado no gateway → executar correção via SQL atualizando `bid_purchases.payment_status = 'paid'` e `affiliate_commissions.status = 'approved'`, creditando lances + comissão.
- **B)** Cliente não pagou → cancelar a compra e a comissão (status `cancelled`).
- **C)** Apenas aguardar — manter como está.

**3. Corrigir flag `is_repurchase` (opcional)**
Se o cenário A for confirmado, marcar a segunda comissão (ID `6b5dcfbd`) como `is_repurchase = true` para refletir a realidade no histórico do afiliado.

### Arquivos / ações esperados
- Nenhum arquivo de código alterado nesta etapa (apenas investigação de logs)
- Possível migration SQL pontual para corrigir status, dependendo da resposta do usuário
