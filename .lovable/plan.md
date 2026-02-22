
# Ativar Parceiro Indicado usando Saldo do Patrocinador

## Objetivo

Permitir que um parceiro ACTIVE use seu `available_balance` para pagar o plano de um indicado, sem passar pelo Mercado Pago. O valor sera debitado do saldo do patrocinador e o contrato do indicado sera criado como ACTIVE instantaneamente.

## Fluxo

1. Parceiro acessa a secao "Indique Parceiros"
2. Clica em "Ativar indicado com saldo"
3. Informa o email do indicado e seleciona o plano
4. Sistema valida: saldo suficiente, indicado sem contrato ACTIVE, etc.
5. Edge Function executa tudo atomicamente:
   - Debita `available_balance` do patrocinador
   - Cria contrato ACTIVE para o indicado
   - Registra vinculo de indicacao (`referred_by_user_id`)
   - Credita bonus de lances (se houver)
6. Parceiro ve confirmacao de sucesso

## Alteracoes

### 1. Nova Edge Function: `sponsor-activate-partner`

Arquivo: `supabase/functions/sponsor-activate-partner/index.ts`

Responsabilidades:
- Autenticar o patrocinador via JWT
- Validar que o patrocinador tem contrato ACTIVE
- Validar que o `available_balance` >= `aporte_value` do plano
- Validar que o indicado existe (buscar por email) e nao tem contrato ACTIVE
- Debitar `available_balance` do patrocinador
- Criar contrato ACTIVE para o indicado com `referred_by_user_id` apontando para o patrocinador
- Gerar referral_code unico para o novo contrato
- Creditar bonus de lances ao indicado (se o plano tiver)
- Registrar a operacao em `partner_manual_credits` com tipo `sponsor_activation` para rastreabilidade

Parametros de entrada:
```json
{
  "referredEmail": "indicado@email.com",
  "planId": "uuid-do-plano"
}
```

### 2. Config TOML

Adicionar ao `supabase/config.toml`:
```toml
[functions.sponsor-activate-partner]
verify_jwt = false
```

### 3. Hook `usePartnerContract.ts`

Adicionar funcao `sponsorActivatePartner(referredEmail: string, planId: string)` que:
- Chama a edge function `sponsor-activate-partner`
- Retorna sucesso/erro
- Exibe toast de feedback

### 4. Componente `PartnerReferralSection.tsx`

Adicionar no card "Indique Parceiros":
- Botao "Ativar indicado com saldo" (visivel apenas se `available_balance > 0`)
- Dialog com:
  - Campo de email do indicado
  - Seletor de plano (lista de planos disponiveis)
  - Exibicao do valor do plano e saldo atual
  - Botao de confirmacao
  - Mensagem de sucesso/erro

### 5. Registro de auditoria

A edge function registra em `partner_manual_credits`:
- `partner_contract_id`: contrato do PATROCINADOR
- `amount`: valor negativo (debito)
- `credit_type`: `sponsor_activation`
- `description`: "Ativacao do parceiro [email] - Plano [nome]"
- `consumes_cap`: false (nao consome cap do patrocinador)

## Validacoes de seguranca

- Patrocinador deve estar autenticado
- Contrato do patrocinador deve estar ACTIVE
- Saldo disponivel >= valor do aporte do plano
- Indicado nao pode ter contrato ACTIVE existente
- Indicado nao pode ser o proprio patrocinador
- Indicado deve existir como usuario cadastrado

## O que NAO muda

- Fluxo de pagamento via Mercado Pago (continua funcionando normalmente)
- Logica de saques e repasses
- Calculo de caps e limites semanais
- Central de Anuncios
- Nenhuma tabela nova (usa `partner_manual_credits` existente para registro)
- Nenhuma migracao de banco necessaria (usa tabelas e colunas existentes)
