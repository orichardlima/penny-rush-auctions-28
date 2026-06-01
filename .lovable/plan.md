
# Nova regra do repasse semanal — Central de Anúncios

## Regra
- Confirmou os **7 dias** da semana (seg–dom) → recebe **100%** do repasse semanal.
- Faltou **qualquer dia** → recebe apenas **40%** do repasse semanal.
- Não há mais escala intermediária (hoje é 70% base + 6% por dia).

## Alterações

### 1. Backend — `supabase/functions/partner-weekly-payouts/index.ts`
Substituir a lógica atual (linhas ~85–321):
- `AD_CENTER_REQUIRED_DAYS = 7` (era 5)
- Remover `AD_CENTER_BASE_PERCENTAGE` / `AD_CENTER_BONUS_PERCENTAGE`
- Novo cálculo:
  ```ts
  const adCenterUnlockPercentage = completedAdDays >= 7 ? 100 : 40
  ```
- Manter o log e o campo `ad_center_multiplier` (vai ficar 1.0 ou 0.4).

### 2. Frontend — `src/hooks/useAdCenter.ts`
Atualizar constantes e cálculo do `weekProgress`:
- `REQUIRED_DAYS = 7`
- Remover `BASE_PERCENTAGE` / `BONUS_PERCENTAGE`
- `unlockPercentage = completedDays >= 7 ? 100 : 40`
- `bonusPercentage` deixa de fazer sentido — remover do retorno (ou fixar em 0).

### 3. UI — `src/components/Partner/AdCenterDashboard.tsx`
Ajustar textos/explicações para refletir a nova regra:
- "Confirme TODOS os 7 dias da semana para receber 100% do repasse."
- "Faltou algum dia? Você receberá apenas 40% do repasse desta semana."
- Barra de progresso: meta 7/7 (em vez de 5/5).
- Remover qualquer menção a "70% base + 30% variável".

### 4. Memória do projeto
Atualizar `mem://business-rules/partner-payout-system-consolidated`:
- De "70% base + 30% condicional a 5 dias" → "100% com 7/7 dias confirmados, senão 40%".

## Quando aplica
A partir da semana **atual** — assim que o código for publicado, o próximo processamento de `partner-weekly-payouts` já usa a nova regra. Quem não confirmou todos os 7 dias desta semana cairá para 40%.

Se você preferir aplicar só a partir da **próxima segunda (08/06)**, me avise antes de implementar que eu adiciono um gate por data.

## Fora do escopo
- Não mexer em `partner_payouts` já processados.
- Não alterar caps semanais/totais nem fórmula base do repasse — só o multiplicador final do Central.
- Não mudar UI de admin do Central nem o limite de 1 confirmação por dia.
