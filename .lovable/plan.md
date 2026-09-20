# Plano: Tornar o Percentual Semanal Específico fácil de encontrar no Painel ADM

## Diagnóstico

O recurso já existe, mas está "escondido": o bloco **Percentual Semanal Específico** (`PartnerRevenueOverrideCard`) só aparece dentro do modal de detalhes do parceiro (`PartnerDetailModal`, linha 345), abaixo do resumo semanal — é preciso abrir o parceiro e rolar a tela para encontrá-lo. Não há nenhum acesso direto pela tela de configuração de faturamento nem indicação visual na lista de parceiros.

## Onde está hoje

Painel ADM → Gestão de Parceiros → clicar em um parceiro (abre o modal de detalhes) → rolar até o bloco "Percentual Semanal Específico", logo após o card de faturamento da semana.

## O que vamos mudar

1. **Aba "Exceções" na tela Configurar Faturamento Diário** (`useDailyRevenueConfig` / página correspondente):
   - Lista de todos os parceiros com percentual específico ativo ou já configurado (nome, percentual, status, observação).
   - Busca de parceiro para criar nova exceção sem precisar abrir o modal de detalhes.
   - Ações de ativar/desativar/editar/remover reaproveitando o `usePartnerRevenueOverride`.
   - Histórico de alterações (lido de `partner_revenue_override_audit`).

2. **Selo na lista de parceiros** (`AdminPartnerManagement`): parceiros com exceção ativa exibem um selo "Repasse X%" ao lado do nome, deixando claro quem tem regra específica.

3. **Manter** o bloco dentro do modal de detalhes do parceiro (já funciona) — nada muda ali.

## Detalhes técnicos

- Reuso total do hook `usePartnerRevenueOverride` e das tabelas `partner_revenue_overrides` / `partner_revenue_override_audit` (já migradas, com RLS admin).
- Nenhuma alteração no cálculo de repasses (`partner-weekly-payouts` já lê os overrides).
- Nenhuma alteração em fluxos não relacionados; apenas UI administrativa.
