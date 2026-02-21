

# Plano: Contabilizar 30% perdido no cap de 200%

## Situacao Atual

Quando o parceiro nao faz a divulgacao na Central de Anuncios, o sistema:
1. Calcula o repasse completo (ex: R$ 100)
2. Aplica o multiplicador da Central (ex: 70% = R$ 70)
3. Paga R$ 70 ao parceiro
4. Soma R$ 70 ao `total_received` (progresso do cap 200%)

Resultado: o parceiro recebe menos, mas o cap "anda devagar", como se ele tivesse mais tempo para receber.

## Nova Regra

O valor COMPLETO (antes do desconto da Central de Anuncios) sera contabilizado no `total_received`, independente do quanto o parceiro efetivamente recebeu.

Exemplo com aporte de R$ 1.000 (cap 200% = R$ 2.000):
- Repasse calculado da semana: R$ 100
- Parceiro nao divulgou: recebe 70% = R$ 70
- `available_balance` recebe +R$ 70 (valor real creditado)
- `total_received` recebe +R$ 100 (valor completo, consumindo o cap)

Isso significa que os 30% perdidos sao "queimados" do teto, penalizando o parceiro que nao divulga.

## Alteracao

Apenas o arquivo `supabase/functions/partner-weekly-payouts/index.ts` sera modificado.

### Detalhe tecnico (linha 351)

Alterar de:
```
const newTotalReceived = contract.total_received + finalAmount
```

Para:
```
const newTotalReceived = contract.total_received + amountAfterCaps
```

A variavel `amountAfterCaps` contem o valor completo (apos tetos semanal/total, mas ANTES do desconto da Central de Anuncios). Ja a variavel `finalAmount` continua sendo usada para o `available_balance` (o que o parceiro efetivamente recebe).

### O que NAO muda
- O valor creditado ao parceiro (`available_balance`) continua sendo o `finalAmount`
- A logica de teto semanal e total permanece a mesma
- A logica da Central de Anuncios permanece a mesma
- A verificacao de fechamento do contrato (`shouldClose`) usara o novo `total_received` mais agressivo
- Nenhuma mudanca no frontend, banco de dados ou outros componentes
