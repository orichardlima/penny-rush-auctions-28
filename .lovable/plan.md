

# Adicionar data de ativação no PartnerDetailModal

## O que será feito

Adicionar a data de ativação (campo `created_at` do contrato) na linha de descrição do modal, ao lado do plano, aporte e status.

## Alteração

### `src/components/Admin/PartnerDetailModal.tsx`

Linha 84 — expandir o `DialogDescription` para incluir a data de ativação:

```
Plano Legend · Aporte R$ 9.999,00 · Status: ACTIVE
```

Passará a exibir:

```
Plano Legend · Aporte R$ 9.999,00 · Ativado em 05/03/2026 · Status: ACTIVE
```

Usa `formatDate(contract?.created_at)` que já existe no componente.

## Impacto

- Apenas visual, uma informação extra na descrição do modal
- Nenhuma alteração em queries, tabelas ou outros componentes

