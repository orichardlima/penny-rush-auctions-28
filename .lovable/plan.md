# Correção: ativação pelo patrocinador sem vínculo de indicação

## O que aconteceu (confirmado no banco)

O contrato de `testedesaldo@gmail.com` (criado em 20/08/2026 20:18, plano Diamond, pago com Crédito de Confiança do Richard) foi gravado com **`referred_by_user_id` = vazio**.

Consequências verificadas:
- Nenhum bônus de indicação foi gerado (o último registro em `partner_referral_bonuses` é de 19/08).
- Nenhum vínculo de equipe foi criado (`expansion_team_memberships` = 0 linhas para esse usuário).
- Por isso ele **não aparece no Histórico de Indicações** do Richard.

Causa: a função de ativação `sponsor-activate-partner` procura o indicador em três lugares — intenções de pagamento anteriores, contratos anteriores e indicações de afiliado. Esse usuário não tinha nenhum dos três. O código de indicação dele está gravado no **perfil** (`referred_by_partner_code = O01F9CG5`, que é exatamente o código do contrato do Richard), e essa fonte não é consultada.

## O que será feito

### 1. Corrigir a função de ativação (evita novos casos)
Adicionar mais uma etapa na busca do indicador, antes de desistir: procurar `profiles.referred_by_partner_code` do indicado e converter esse código no dono do contrato correspondente (`partner_contracts.referral_code`). Mantidas todas as regras atuais (o pagador não vira indicador por padrão; a ordem de prioridade existente não muda).

Se ainda assim não houver indicador, a ativação continua acontecendo — mas passará a registrar aviso no log para auditoria.

### 2. Corrigir o caso do Richard (retroativo)
Vincular o contrato de `testedesaldo@gmail.com` ao Richard e disparar o que ficou faltando:
- gravar o indicador no contrato;
- gerar os bônus de indicação de nível 1/2/3 conforme as regras vigentes;
- criar o vínculo na rede de equipes e os pontos de carreira correspondentes.

Como a posição na rede é definitiva e protegida por trava, o ajuste será feito com o override administrativo já existente, apenas para esse contrato, com auditoria.

## Detalhes técnicos

- Arquivo: `supabase/functions/sponsor-activate-partner/index.ts` — novo fallback lendo `profiles.referred_by_partner_code` → `partner_contracts.referral_code` (contrato ATIVO) → `user_id`.
- Backfill: migration única que ativa `expansion_position_override_active`, atualiza `partner_contracts.referred_by_user_id` do contrato `5a3833c8-…` para `18c062cb-…` (Richard). O trigger `on_partner_contract_referred_updated` já chama `ensure_partner_referral_bonuses`, e `trg_expansion_on_contract` cria as memberships/pontos.
- Verificação pós-execução: conferir 3 linhas novas em `partner_referral_bonuses` e memberships criadas para o usuário.

## Fora do escopo
Nenhuma alteração em telas, no Crédito de Confiança, na dívida já registrada (R$ 25.000 vencendo 04/09) ou em qualquer outra regra financeira.
