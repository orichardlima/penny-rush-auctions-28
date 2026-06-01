
# Por que a Sabriny só tem R$ 575 disponível

## Diagnóstico
Investiguei o contrato da **Sabriny Amorim** (Diamond, aporte R$ 25.000, contrato `abd3ffff…`). Saldo correto deveria estar maior. O que aconteceu:

1. Em **13/05/2026** a indicada dela **Maria Marta Silva Pacheco** ativou um Diamond → gerou bônus de **R$ 4.000** (16% nível 1) para Sabriny. Bônus liberado, payout `PAID`.
2. Em **31/05/2026 14:23**, **a própria Sabriny** acionou "Sair da rede do patrocinador" (motivo: "Motivo pessoal!").
3. A função `partner_request_leave_sponsor` reverteu **todos** os bônus cujo `referred_contract_id` está dentro da subárvore que está saindo — incluindo o bônus de R$ 4.000 que a **própria Sabriny** havia ganhado da Maria Marta (downline dela).

Esse cancelamento está incorreto. A intenção da função é cancelar bônus que iriam para o **patrocinador antigo** (acima da Sabriny). Mas o `WHERE` atual não filtra por quem é o **recebedor** (`referrer_contract_id`), só pelo `referred_contract_id`, então também derrubou bônus internos da própria subárvore.

Comprovação no log:
- `admin_audit_log` → `PARTNER_SELF_LEAVE_NETWORK` com `reversed_available_total: 4000`.
- `partner_referral_bonuses` `7385cfe2…` (referrer = Sabriny, referred = Maria Marta) virou `CANCELLED`.
- `partner_payouts` `84e1d48d…` (R$ 4.000) ficou `CANCELLED`.

Os outros R$ 4.000 + R$ 500 cancelados (bônus que a antiga upline **Géssica** receberia da Sabriny e da Maria Marta) estão corretamente cancelados — esses sim deveriam sair quando a Sabriny pediu saída.

## O que vou fazer

### 1. Corrigir a função `partner_request_leave_sponsor`
Ajustar o `WHERE` dos blocos de cancelamento (PENDING e AVAILABLE) para também exigir que o **recebedor** do bônus esteja **fora** da subárvore que está saindo. Ou seja: só cancelar bônus que sobem para uplines antigas, nunca bônus internos do próprio grupo.

```sql
WHERE b.referred_contract_id IN (SELECT id FROM descendants)
  AND b.referrer_contract_id NOT IN (SELECT id FROM descendants)
```

Aplicar o mesmo ajuste em `admin_transfer_partner_sponsor` (mesma lógica clonada).

### 2. Restaurar o bônus indevidamente cancelado da Sabriny
Migration data-fix:
- `partner_referral_bonuses 7385cfe2…` → `status='AVAILABLE'` (remover sufixo do `source_event` se houver marcação de leave).
- `partner_payouts 84e1d48d…` → `status='PAID'`.
- Recalcular `partner_contracts.total_received` da Sabriny via `SUM(amount) FROM partner_payouts WHERE status='PAID'`.
- Saldo disponível volta a refletir o real (575 + 4.000 = ~R$ 4.575 menos taxas se houver).

### 3. Validação pós-migration
- Conferir o saldo da Sabriny no painel (`/dashboard` → Minha Parceria → Saques) — esperado ~R$ 4.575.
- Rodar busca por outros parceiros que também tenham sofrido a mesma reversão indevida (qualquer `PARTNER_SELF_LEAVE_NETWORK` ou `ADMIN_TRANSFER_SPONSOR` com `reversed_available_total > 0` onde o bônus revertido tem `referrer` dentro da própria subárvore). Se aparecer mais alguém, restauro junto.

## Fora do escopo
- Não mexer na regra do cutoff Géssica (continua valendo).
- Não tocar nos R$ 4.000 + R$ 500 da Géssica (cancelamento correto).
- Sem mudanças de UI.
