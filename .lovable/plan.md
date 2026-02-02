
## Plano: Corrigir Bug de Data e Processar Semana 26/01–01/02

### Diagnóstico

**Problema identificado**: O rendimento da semana 26/01 a 01/02 não aparece porque:

1. As configurações diárias estão corretas na tabela `daily_revenue_config`:
   - Segunda 26/01: 0.30%
   - Terça 27/01: 0.18%
   - Quarta 28/01: 0.25%
   - Quinta 29/01: 0.23%
   - Sexta 30/01: 0.27%
   - Sábado 31/01: 0.24%
   - Domingo 01/02: 0.23%
   - **Total: 1.70%** (~R$ 170 para Legend)

2. **Não existe registro em `partner_payouts`** para esta semana - o admin ainda não processou

3. Há um **bug de fuso horário** no processamento que pode causar problemas:
   ```typescript
   // Linha 609 - BUG
   const weekStartDate = new Date(weekStart);  // "2026-01-26" → UTC → no Brasil vira 25/01 21h
   ```

---

### Alterações

| Arquivo | O que será feito |
|---------|------------------|
| `src/hooks/useAdminPartners.ts` | Corrigir bug de data usando `parseLocalDate()` |

---

### Seção Técnica

**Linhas 606-612 (useAdminPartners.ts):**

```typescript
// ANTES (com bug de UTC)
const weekStartDate = new Date(weekStart);
const weekEndDate = getWeekEnd(weekStartDate);
const weekEnd = weekEndDate.toISOString().split('T')[0];

// DEPOIS (corrigido com parseLocalDate)
const weekStartDate = parseLocalDate(weekStart);  // Já existe no arquivo
const weekEndDate = getWeekEnd(weekStartDate);
const weekEnd = formatLocalDate(weekEndDate);  // Já existe no arquivo
```

**Linhas 771-772 (modo automático):**

```typescript
// ANTES
.gte('created_at', weekStartDate.toISOString())
.lt('created_at', new Date(weekEndDate.getTime() + 86400000).toISOString())

// DEPOIS (usar datas locais para queries de compras)
.gte('created_at', `${formatLocalDate(weekStartDate)}T00:00:00-03:00`)
.lt('created_at', `${formatLocalDate(new Date(weekEndDate.getTime() + 86400000))}T00:00:00-03:00`)
```

---

### Próximo Passo Após Implementação

Após corrigir o bug, o admin deve:

1. Ir em **Admin > Parceiros > Repasses**
2. Selecionar a semana **26/01 - 01/02**
3. Escolher **"Usar Faturamento Diário"**
4. Clicar em **"Processar Repasses"**

Isso criará os registros em `partner_payouts` e o rendimento aparecerá no painel do parceiro.

---

### Fase 2 (Automação - Próxima Iteração)

Após aprovar esta correção, podemos implementar a automação via Edge Function para que o sistema processe automaticamente os repasses semanais às segundas-feiras, eliminando a necessidade de ação manual do admin.
