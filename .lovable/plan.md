# Carência do bônus de indicação: 7 dias úteis

Hoje a carência é de 7 dias corridos (168 horas) a partir do horário exato da ativação. Passa a ser **7 dias úteis** (segunda a sexta; sábados e domingos não contam), mantendo o **mesmo horário** da ativação.

Exemplo: ativação sexta 24/08 às 18:39 → liberação na terça seguinte, 02/09 às 18:39.

## O que muda

- Todo bônus de indicação novo (níveis 1, 2 e 3, incluindo início rápido e reativação após pagamento) passa a liberar no 7º dia útil, no mesmo horário da ativação.
- Os bônus **hoje em validação** são recalculados para a nova regra — a data de liberação deles será adiada.
- Textos do painel do parceiro passam a dizer "7 dias úteis (seg a sex)" no lugar de "7 dias corridos (168 horas)": coluna Liberação, tooltip do status "Em validação", aviso no rodapé da seção de indicações e na lista de bônus de rede.
- Nada muda em valores, percentuais, carteira, saques ou na rotina automática de liberação (que continua rodando a cada 30 minutos e libera quando a data/hora chega).

## Detalhes técnicos

Migration:
- Nova função `public.add_business_days(ts timestamptz, days int)` — soma dias úteis preservando hora, avaliando o dia da semana no fuso America/Bahia.
- Substituir `NOW() + INTERVAL '7 days'` por `add_business_days(NOW(), 7)` em `ensure_partner_referral_bonuses` (3 ocorrências), `process_partner_referral_bonus` e `unsuspend_bonuses_on_payment`. A ocorrência em `get_partner_performance_summary` não é de carência e fica intacta.
- Backfill dos pendentes: para `partner_referral_bonuses` com `status='PENDING'` e `available_at > now()`, recalcular `available_at = add_business_days(created_at, 7)`. Bônus já vencidos/liberados não são tocados.

Frontend (apenas texto):
- `src/components/Partner/PartnerReferralSection.tsx` (tooltip + disclaimer)
- `src/components/ReferralBonusList.tsx` (texto equivalente)
- `src/lib/releaseTime.ts` permanece como está (formatação de data/hora e contagem regressiva continuam válidas).
