

# Configurações de Saques (Parceiros e Afiliados)

## Objetivo

Adicionar no painel administrativo (SystemSettings) uma seção de configurações de saques que controle: dias permitidos, janela de horário, taxa percentual e valor mínimo. Essas regras serão aplicadas tanto para saques de parceiros quanto de afiliados.

## Novas configurações em `system_settings`

| setting_key | setting_type | default | Descrição |
|---|---|---|---|
| `withdrawal_allowed_days` | `string` | `"1,2,3,4,5"` | Dias da semana permitidos (0=Dom, 1=Seg... 6=Sáb) |
| `withdrawal_start_hour` | `number` | `8` | Hora de início da janela (0-23) |
| `withdrawal_end_hour` | `number` | `18` | Hora de fim da janela (0-23) |
| `withdrawal_fee_percentage` | `number` | `0` | Taxa descontada do valor solicitado (%) |
| `partner_min_withdrawal` | `number` | `50` | Valor mínimo de saque para parceiros (R$) |
| `affiliate_min_withdrawal` | `number` | `50` | Já existe, será integrado na UI |

## Alterações

### 1. Migration: Inserir novas configurações

INSERT das 5 novas linhas em `system_settings` (a `affiliate_min_withdrawal` já existe).

### 2. SystemSettings.tsx: Nova seção "Saques"

Adicionar uma nova aba/card dentro das configurações do sistema com:
- Checkboxes para cada dia da semana (Seg a Dom)
- Campos numéricos para hora início e fim
- Campo para taxa de saque (%)
- Campos para valor mínimo (parceiros e afiliados)
- Botão salvar

### 3. usePartnerWithdrawals.ts: Validar regras antes de solicitar

No `requestWithdrawal`:
- Buscar as configurações `withdrawal_allowed_days`, `withdrawal_start_hour`, `withdrawal_end_hour`, `withdrawal_fee_percentage`, `partner_min_withdrawal`
- Validar dia e horário atual (fuso BRT)
- Validar valor mínimo
- Se houver taxa, calcular valor líquido e informar ao usuário
- Armazenar `fee_amount` e `net_amount` no registro do saque

### 4. useAffiliateWithdrawals.ts: Mesmas validações

Aplicar as mesmas regras de dia/horário/taxa/mínimo usando `affiliate_min_withdrawal`.

### 5. PartnerWithdrawalSection.tsx: Exibir regras e taxa

- Mostrar aviso quando fora do dia/horário permitido (botão desabilitado)
- Mostrar preview da taxa: "Valor solicitado: R$ 100 → Taxa 5%: R$ 5 → Você recebe: R$ 95"
- Mostrar valor mínimo

### 6. AffiliateWithdrawalSection: Mesmas adaptações visuais

## Fluxo do usuário

1. Parceiro clica em "Solicitar Saque"
2. Sistema verifica: é dia permitido? Está dentro do horário? Valor >= mínimo?
3. Se houver taxa, mostra: "Será descontada uma taxa de X% (R$ Y). Valor líquido: R$ Z"
4. Usuário confirma → registro criado com `fee_amount` e `net_amount`

## Campos adicionais na tabela `partner_withdrawals`

Migration para adicionar:
- `fee_percentage` (numeric, default 0)
- `fee_amount` (numeric, default 0)
- `net_amount` (numeric, nullable)

Mesmos campos em `affiliate_withdrawals`.

## Arquivos alterados

- `supabase/migrations/` — 1 migration (INSERT settings + ALTER tables)
- `src/components/SystemSettings.tsx` — nova seção de saques
- `src/hooks/usePartnerWithdrawals.ts` — validações + taxa
- `src/hooks/useAffiliateWithdrawals.ts` — mesmas validações
- `src/components/Partner/PartnerWithdrawalSection.tsx` — UI de regras/taxa
- `src/components/Affiliate/AffiliateWithdrawalSection.tsx` — UI de regras/taxa

