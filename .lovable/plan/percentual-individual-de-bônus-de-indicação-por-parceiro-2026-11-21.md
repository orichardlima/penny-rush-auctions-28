# Percentual individual de bônus de indicação por parceiro

## Sugestão
Hoje o percentual do bônus de indicação (Nível 1) vem do plano do patrocinador (ex.: Diamond 16%). A proposta é permitir que o ADM defina um percentual próprio para parceiros específicos, que substitui o do plano apenas para eles. Quem não tiver percentual individual continua usando o do plano, sem nenhuma mudança.

## Como vai funcionar
- No detalhe do parceiro (painel ADM), novo campo "Bônus de indicação individual (%)", ao lado do percentual de repasse individual que já existe.
- O ADM informa o percentual (ex.: 20%) e um motivo; pode remover a qualquer momento para voltar ao percentual do plano.
- Vale somente para novas ativações e upgrades indicados a partir da alteração. Bônus já gerados (pendentes ou pagos) não são recalculados.
- Níveis 2 (2%) e 3 (0,5%) continuam iguais.
- Toda alteração fica registrada em auditoria (quem alterou, valor anterior, novo, motivo e data).
- Na tela do parceiro, o percentual mostrado passa a ser o efetivo.

## Detalhes técnicos
- Nova tabela `partner_referral_bonus_overrides` (partner user_id, percentage 0-50, reason, set_by, timestamps) + tabela de auditoria; RLS só admin; grants explícitos.
- RPC SECURITY DEFINER `admin_set_referral_bonus_override` validando `has_role(auth.uid(),'admin')`.
- Ajuste pontual nas funções de geração de bônus de L1 (`create_cascade_referral_bonuses`/`ensure_partner_referral_bonuses`): `COALESCE(override, plano.referral_bonus_percentage, 10)`. Nenhuma outra regra (carência, data de corte, Início Rápido, inadimplência) muda.
- UI: campo em `PartnerDetailModal.tsx` seguindo o padrão de `usePartnerRevenueOverride`.
- Teste: parceiro Diamond com override 20% gera 20% em nova ativação; sem override gera 16%.
