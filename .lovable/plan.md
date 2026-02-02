

## Plano: Corrigir Botão de Confirmar Saque Desabilitado

### Problema Identificado

O botão "Confirmar Saque" está desabilitado mesmo quando o valor digitado é igual ou menor que o saldo disponível. Isso ocorre devido a **problemas de precisão de ponto flutuante** no JavaScript.

**Exemplo do problema:**
- Saldo calculado internamente: `169.98999999999998`
- Valor digitado pelo usuário: `169.99`
- Comparação: `169.99 > 169.98999999998` = `true` → Botão desabilitado ❌

---

### Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/Partner/PartnerWithdrawalSection.tsx` | Corrigir comparação de valores |

---

### Solução

Arredondar ambos os valores para 2 casas decimais antes de comparar, eliminando problemas de precisão de ponto flutuante.

**Antes (linha 288):**
```typescript
disabled={submitting || !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 || parseFloat(withdrawalAmount) > availableBalance}
```

**Depois:**
```typescript
disabled={submitting || !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 || Math.round(parseFloat(withdrawalAmount) * 100) > Math.round(availableBalance * 100)}
```

**Explicação da correção:**
- Multiplica ambos os valores por 100 para trabalhar com centavos (inteiros)
- Usa `Math.round()` para eliminar imprecisões de ponto flutuante
- Compara inteiros, que não têm problemas de precisão
- Exemplo: `Math.round(169.99 * 100) = 16999` vs `Math.round(169.99 * 100) = 16999` → `false` → Botão habilitado ✅

---

### Mudanças Adicionais Recomendadas

Para maior segurança, também podemos arredondar o `availableBalance` ao exibir e ao usar "Usar saldo total":

1. **Linha 276** - Função "Usar saldo total":
```typescript
// Garantir que o valor definido seja exatamente 2 casas
onClick={() => setWithdrawalAmount((Math.round(availableBalance * 100) / 100).toFixed(2))}
```

---

### Resultado Esperado

Após a correção:
- Digitar **169,99** quando o saldo é **R$ 169,99** → Botão habilitado ✅
- Clicar em "Usar saldo total" → Define valor correto e botão habilitado ✅

