

## Plano: Corrigir Validação de Saldo no Hook de Saques

### Problema Identificado

A validação no hook `usePartnerWithdrawals.ts` também está usando comparação direta de ponto flutuante, causando o mesmo problema já corrigido no botão:

**Linha 111:**
```typescript
if (amount > availableBalance) {
```

**Cenário:**
- Valor solicitado: `169.99`
- Saldo calculado internamente: `169.98999999999998`
- Comparação: `169.99 > 169.98999999999998` = `true` → Erro "Saldo insuficiente" ❌

---

### Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/usePartnerWithdrawals.ts` | Corrigir comparação de valores na validação |

---

### Solução

Aplicar a mesma correção usada no botão: comparar valores arredondados como centavos (inteiros).

**Antes (linha 111):**
```typescript
if (amount > availableBalance) {
```

**Depois:**
```typescript
if (Math.round(amount * 100) > Math.round(availableBalance * 100)) {
```

---

### Resultado Esperado

Após a correção:
- Sacar **R$ 169,99** quando o saldo é **R$ 169,99** → Saque processado com sucesso ✅
- A comparação `Math.round(16999) > Math.round(16999)` = `false` → Validação passa ✅

