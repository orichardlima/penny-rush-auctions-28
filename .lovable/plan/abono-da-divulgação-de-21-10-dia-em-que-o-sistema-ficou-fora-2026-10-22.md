# Abono da divulgação de 21/10 (dia em que o sistema ficou fora do ar)

## Situação verificada
- Em 21/10, só 6 confirmações de divulgação foram registradas. Nos dias anteriores, a média foi de 8 a 12.
- Existem 67 contratos de parceiro ativos.
- A semana de 19/10 a 25/10 ainda não foi fechada para os repasses, então o abono entra no cálculo normal, sem ajuste manual depois.

## O que será feito
1. Registrar a divulgação de 21/10 para todos os parceiros com contrato ativo que ainda não confirmaram nesse dia.
2. Essas confirmações ficam marcadas como **"Abono do sistema - instabilidade 21/10"**. Assim dá para diferenciar de uma divulgação feita de verdade, e o abono pode ser desfeito se precisar.
3. As 6 confirmações reais de 21/10 continuam como estão.
4. Conferir depois: os 67 contratos ativos com 21/10 confirmado, e o painel do parceiro mostrando o dia como cumprido.

Nenhuma tela, regra ou valor muda. O que muda é só o registro desse dia.

## Detalhes técnicos
- Inserir em `ad_center_completions` uma linha por contrato `ACTIVE` sem registro em `completion_date = '2026-10-21'`. Usar `social_network = 'system_grace'` e o `material_id` do material ativo daquele dia (`b97470e0-...`). `confirmed_at = now()`.
- Antes, conferir se o cálculo de 30% condicional usa só a existência da linha por dia, e se `system_grace` não quebra validações por rede social. Se quebrar, usar `whatsapp` e registrar o abono em `admin_audit_log`.
- Para reverter: apagar as linhas com `social_network = 'system_grace'` e `completion_date = '2026-10-21'`.
