# Crédito de Confiança — prazo por uso e limite rotativo

## Situação atual (verificada no código)

O prazo já funciona como você deseja: a dívida só nasce quando o líder ativa alguém com o crédito. Na ativação (`sponsor-activate-partner`), o sistema cria o registro de dívida com vencimento = data da ativação + prazo configurado (padrão 7 dias). Se o líder tem R$ 1.000 de limite e nunca usa, não existe dívida, não existe vencimento e não existe cobrança. Se usa R$ 250, só esses R$ 250 têm prazo; os R$ 750 restantes continuam parados sem contar nada.

Ou seja, "ele devolve o que não usou" já é o comportamento natural — o não usado nunca saiu.

## O que vale ajustar

### 1. Deixar a regra explícita para o líder
No cartão de Crédito de Confiança do painel do parceiro, mostrar um aviso curto: "O prazo de devolução só começa a contar quando você usa o crédito. Limite parado não gera cobrança." Cada ativação aparece como uma dívida separada, com seu próprio vencimento — isso já acontece, só não está explicado.

### 2. Prazo por uso, não por líder
Hoje o prazo vem do limite do líder no momento do uso. Manter assim, mas gravar o prazo aplicado dentro da própria dívida, para que uma mudança futura no limite não altere vencimentos de dívidas antigas.

### 3. Validade opcional do limite concedido
Campo opcional no admin: "válido até". Se a data passar e o líder não tiver usado, o limite disponível deixa de poder ser usado (as dívidas em aberto continuam intactas). Serve para você não deixar limites esquecidos abertos por meses. Sem data preenchida, o limite é permanente como hoje.

### 4. Devolução parcial
Permitir que o líder pague parte de uma dívida via PIX, com o restante seguindo em aberto até o vencimento. Hoje a devolução é integral por dívida.

### 5. Visão no admin
Na aba Crédito de Confiança, separar em duas leituras: limite concedido x limite efetivamente em uso, e sinalizar líderes com limite concedido e uso zero (limite ocioso).

## Detalhes técnicos

- `partner_credit_debts`: adicionar `term_days` (prazo congelado no momento do uso).
- `partner_credit_lines`: adicionar `valid_until` (nullable). Checagem na edge function de ativação e no `partner_credit_available`.
- Devolução parcial: `partner-credit-repay` aceita valor; webhook `credit:` abate o valor pago, atualiza `paid_amount` e só marca `PAID` quando quitar o total; o limite volta na proporção paga.
- UI: aviso no `PartnerCreditCard.tsx`, campo de validade e coluna de limite ocioso em `PartnerCreditManagement.tsx`.

## Escopo não alterado

Nenhuma mudança em ativação por saldo próprio, repasses, bônus ou regras de rede.
