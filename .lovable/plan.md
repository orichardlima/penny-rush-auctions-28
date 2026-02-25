

# Correção: "Próximo +R$" sem valor

## Problema

A label "Próximo +R$:" não mostra o valor real do incremento (ex: R$0,20) porque o hook `useFuryVault` não busca o campo `accumulation_value` da tabela `fury_vault_config`. O resultado é um texto incompleto: "Próximo +R$:" seguido de nada, com apenas "3 lances" no lado direito.

## Causa Raiz

No `useFuryVault.ts`, linha 67, a query seleciona apenas 4 campos:
```
.select('accumulation_interval, min_bids_to_qualify, is_active, recency_seconds')
```
Falta `accumulation_value` (o valor em reais adicionado a cada intervalo de lances).

## Correções

### 1. `src/hooks/useFuryVault.ts`

- Adicionar `accumulation_value` na query do config (linha 67)
- Adicionar `accumulation_value` na interface `FuryVaultConfig`

### 2. `src/components/FuryVaultDisplay.tsx`

- Linha 134: Trocar `<span>Próximo +R$:</span>` por `<span>Próximo {formatPrice(config.accumulation_value)}:</span>`
- Isso exibirá, por exemplo: **"Próximo R$0,20:"** seguido de **"3 lances"**

### 3. Correções adicionais (do plano anterior aprovado)

- Cor das barras de progresso: adicionar `[&>div]:bg-accent` nas duas barras `Progress` (linhas 137 e 167) para ficarem douradas em vez de vermelhas
- Plural: corrigir "1 qualificados" → "1 qualificado" (linha 146)

## Resultado Visual Esperado

```text
┌───────────────────────────────────┐
│ 🔒 Cofre Fúria          R$25,60  │
│                                   │
│ Próximo R$0,20:                   │
│ [████████████████████░░░] 3 lances│
│                                   │
│ 👥 1 qualificado                  │
│ ✓ Você está qualificado (24/15)   │
└───────────────────────────────────┘
```

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useFuryVault.ts` | Adicionar `accumulation_value` na query e interface |
| `src/components/FuryVaultDisplay.tsx` | Mostrar valor do incremento, cor accent nas barras, plural correto |

## Sem Impacto Em

- Nenhuma funcionalidade alterada
- Nenhum outro componente ou workflow afetado

