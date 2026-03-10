

## Plano: Comissão de Afiliados em Recompras (Taxa Reduzida, Sem Limite)

### Modelo
- **1ª compra**: taxa atual do afiliado (`commission_rate`, ex: 10%)
- **Recompras**: taxa reduzida configurável pelo admin (ex: 5%)
- **Sem limite** de recompras comissionadas

### Alterações

**1. Nova configuração admin (`system_settings`)**
Adicionar setting `affiliate_repurchase_commission_rate` (padrão: 5%) no painel de configurações de afiliados em `AdminAffiliateManagement.tsx`. Também adicionar um switch `affiliate_repurchase_enabled` (padrão: false) para o admin ligar/desligar o recurso.

**2. Coluna na tabela `affiliate_commissions`**
Migration: adicionar coluna `is_repurchase boolean default false` para diferenciar comissões de 1ª compra vs recompras nos relatórios e dashboards.

**3. Edge Function `mercado-pago-payment/index.ts` (lógica principal)**
Refatorar o bloco de referral (linhas 238-284):

- Se já existe comissão aprovada/paga para o `referred_user_id` → é **recompra**
  - Buscar setting `affiliate_repurchase_enabled`; se false, pular
  - Usar `affiliate_repurchase_commission_rate` (ou fallback do afiliado individual se configurado)
  - Inserir comissão com `is_repurchase = true`
- Se não existe → é **primeira compra** (comportamento atual mantido)

**4. Configuração por afiliado individual (opcional mas recomendado)**
Adicionar coluna `repurchase_commission_rate numeric default null` na tabela `affiliates`. Se preenchido, sobrescreve a taxa global. Exibir campo no `EditCommissionModal.tsx` e no modal de edição do admin.

**5. UI — Dashboard do Afiliado (`AffiliateDashboard.tsx`)**
- Atualizar textos de "primeira compra" para refletir o novo modelo
- Separar visualmente comissões de 1ª compra vs recompras na listagem
- Mostrar as duas taxas (1ª compra e recompras)

**6. UI — Admin (`AdminAffiliateManagement.tsx`)**
- Adicionar campo "Taxa de Recompra (%)" na seção "Modelo de Comissão"
- Adicionar switch "Comissionar Recompras"
- Badge "Recompra" na listagem de comissões

**7. Webhook (`mercado-pago-webhook/index.ts`)**
Nenhuma alteração necessária — já aprova/cancela comissões pelo `purchase_id`, independente de ser recompra.

### Resumo de arquivos

| Arquivo | Tipo |
|---|---|
| Migration SQL | Nova coluna `is_repurchase` em `affiliate_commissions`, `repurchase_commission_rate` em `affiliates` |
| `mercado-pago-payment/index.ts` | Lógica de recompra |
| `AdminAffiliateManagement.tsx` | Config global de recompra |
| `EditCommissionModal.tsx` | Taxa individual de recompra |
| `AffiliateDashboard.tsx` | Textos e separação visual |

