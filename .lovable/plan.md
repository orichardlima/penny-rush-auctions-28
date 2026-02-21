

# Exibir data de liberacao no modal de detalhes do parceiro (Admin)

## Objetivo

No modal `PartnerDetailModal`, na aba "Indicacao", exibir a data prevista de liberacao (`available_at`) ao lado do badge "Pendente", para que o admin saiba quando o bonus sera liberado.

## Alteracao

Apenas o arquivo `src/components/Admin/PartnerDetailModal.tsx` sera modificado.

### O que muda (linha ~223)

Na celula de Status dos bonus de indicacao, quando o status for `PENDING` e existir `available_at`, exibir a data formatada ao lado do badge. Exemplo visual: **Pendente** (libera 26/02/2026)

### Detalhe tecnico

Substituir a linha:
```
<TableCell>{getStatusBadge(b.status)}</TableCell>
```

Por:
```
<TableCell>
  <div className="flex items-center gap-1.5">
    {getStatusBadge(b.status)}
    {b.status === 'PENDING' && b.available_at && (
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        (libera {formatDate(b.available_at)})
      </span>
    )}
  </div>
</TableCell>
```

### Nenhuma outra alteracao
- Nenhuma mudanca no banco de dados
- Nenhuma mudanca em outros componentes ou hooks
- Nenhuma mudanca na logica de negocio

