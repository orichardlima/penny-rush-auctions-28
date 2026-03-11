

## Plano: Contrato Demo — Flag interna no contrato, sem plano público

**STATUS: ✅ IMPLEMENTADO**

### O que foi feito

1. **Migration SQL** — Coluna `is_demo` + guards nas funções `ensure_partner_referral_bonuses` e `position_partner_binary`
2. **Edge Function `partner-weekly-payouts`** — Contratos demo são pulados no processamento
3. **AdminUserManagement** — Switch "Contrato Demo (líder)" no dialog de atribuição de plano
4. **AdminPartnerManagement** — Badge "DEMO" + botão "Converter para Regular" com bônus retroativos
5. **PartnerDashboard** — Banner informativo para parceiros em modo demonstração
