# Ajustes de repasse: Angelo e Simara

## Objetivo
Aplicar os créditos pedidos na imagem, sem duplicidade e com registro de auditoria:
- Angelo Silva Santiago: + R$ 311,00 no repasse semanal.
- Simara Serra dos Santos Santiago: + R$ 3.122,00 no repasse semanal.
- Simara: + R$ 1.370,00 de bônus de 20% sobre a perna menor (6.850 pontos).

## Passo 1 — Conferência (nada é alterado)
- Localizar as contas e os repasses das duas primeiras semanas de cada um.
- Confirmar que os repasses saíram com 40% por falta de anúncio e calcular a diferença real até 100%. Comparar o resultado com os R$ 311,00 e os R$ 3.122,00.
- Para o bônus de 20% da Simara, conferir de onde vêm os 6.850 pontos e se essa semana já foi paga no Bônus de Equipe. Ela já recebeu R$ 876,00 nas semanas de 26/10 e 02/11, então pode haver pagamento em dobro.
- Apresentar a tabela com os valores pedidos, os valores calculados e as diferenças.

## Passo 2 — Crédito (somente após sua confirmação dos números)
- Lançar cada valor como ajuste manual, com o motivo "Ajuste autorizado por Richard Lima — tolerância de anúncios" ou "bônus perna menor", e uma referência única para não creditar duas vezes.
- O dinheiro fica disponível para saque no mesmo lugar dos repasses atuais.
- Não muda nenhuma regra, cálculo ou tela.

## Passo 3 — Verificação
- Conferir que cada lançamento aparece uma vez nos detalhes do parceiro e que o saldo aumentou exatamente pelo valor creditado.

## Detalhes técnicos
- Ajustes via `partner_manual_credits` / `partner_payouts` (payout_type de repasse semanal) e, para o bônus, crédito na carteira de rede (`partner_network_wallet_transactions`) com source_ref único.
- Registro em `admin_audit_log`.
