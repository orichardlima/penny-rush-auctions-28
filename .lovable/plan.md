
# Corrigir: Indicacao NUNCA fica com quem pagou

## Problema

Na linha 96 da edge function `sponsor-activate-partner`, o fallback do `actualReferrerId` e o `sponsorUserId` (quem esta pagando). Isso significa que se nao houver nenhum registro previo de indicacao (`partner_payment_intents` ou contratos anteriores), o pagador acaba sendo definido como o indicador -- o que esta errado.

## Solucao

Alterar o valor inicial de `actualReferrerId` de `sponsorUserId` para `null`. Assim:

- Se existir um registro previo de indicacao, o indicador real sera usado
- Se NAO existir nenhum registro previo, o campo `referred_by_user_id` ficara como `null` (sem indicador)
- O pagador NUNCA sera registrado como indicador

## Alteracao

Arquivo: `supabase/functions/sponsor-activate-partner/index.ts`

- Linha 95: Atualizar comentario para refletir a nova logica
- Linha 96: Mudar `let actualReferrerId: string | null = sponsorUserId;` para `let actualReferrerId: string | null = null;`

Isso garante que a unica forma de alguem ser registrado como indicador e se ja houver um vinculo previo real (via `partner_payment_intents` ou contratos anteriores SUSPENDED/CLOSED).

## O que NAO muda

- Toda a interface (UI) permanece identica
- O fluxo de debito do saldo continua igual
- A criacao do contrato ACTIVE continua igual
- O registro de auditoria em `partner_manual_credits` continua igual
