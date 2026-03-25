

# Corrigir propagação de pontos no upgrade de cotas

## Problema

Quando o admin faz upgrade de cotas (1→2), os valores financeiros são atualizados mas os pontos binários adicionais não são propagados. No caso do João Batista: recebeu upgrade de 1→2 cotas do Legend, mas apenas 1000 pts (1 cota) foram propagados na ativação original. Faltam 1000 pts para cada upline.

## Solução

### 1. Correção retroativa (migração SQL)

Propagar os 1000 pontos faltantes do João Batista para todos os uplines:

```sql
SELECT propagate_binary_points(
  '236eac8e-c587-44cb-bfad-9f78b38a21ce', -- João Batista
  1000,                                      -- pontos da 2ª cota
  'cotas_upgrade_fix',
  '9b8abf57-77e7-446c-84ff-a6acc5c851e2'   -- sponsor
);
```

### 2. Prevenção futura: propagar pontos no upgrade de cotas

**`src/hooks/useAdminPartners.ts`** — Na função `upgradeContractCotas`, após atualizar o contrato, chamar uma RPC que propaga os pontos adicionais:

```typescript
// Após o update do contrato, propagar pontos da(s) cota(s) extra(s)
const extraCotas = newCotas - currentCotas;
const pointsPerCota = planPoints; // do partner_level_points
const extraPoints = extraCotas * pointsPerCota;

if (extraPoints > 0) {
  await supabase.rpc('propagate_binary_points', {
    p_source_contract_id: contractId,
    p_points: extraPoints,
    p_reason: 'cotas_upgrade',
    p_sponsor_contract_id: sponsorContractId
  });
}
```

Para isso, o hook precisa:
- Buscar os pontos do plano em `partner_level_points`
- Buscar o `sponsor_contract_id` da posição binária do contrato
- Chamar a RPC `propagate_binary_points` existente

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Correção retroativa (1000 pts) + prevenção futura via RPC |
| `src/hooks/useAdminPartners.ts` | Adicionar propagação de pontos extras na função `upgradeContractCotas` |

