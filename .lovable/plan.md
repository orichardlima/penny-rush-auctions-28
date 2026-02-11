

## Corrigir Cor do Indicativo de Perna Menor

### Problema
O banner "Perna Menor" usa sempre a cor azul (`bg-blue-500`, `text-blue-700`), independentemente de qual perna e a menor. Azul representa a perna esquerda, e amarelo/amber representa a perna direita. Quando a perna menor e a direita, o banner deveria ser amarelo, nao azul.

### Solucao

**Arquivo: `src/components/Partner/BinaryNetworkTree.tsx`** (linhas 273-278)

Tornar a cor do banner dinamica com base no valor de `stats.weakerLeg`:

- Perna menor **esquerda**: manter azul (`bg-blue-500/10`, `border-blue-500/20`, `text-blue-700`)
- Perna menor **direita**: usar amber (`bg-amber-500/10`, `border-amber-500/20`, `text-amber-700`)

### Detalhe Tecnico

Substituir as classes CSS fixas por classes condicionais:

```text
ANTES:
  className="bg-blue-500/10 border border-blue-500/20 ..."
  className="text-sm text-blue-700"

DEPOIS:
  className={cn(
    "rounded-lg p-3 mb-6 text-center border",
    stats.weakerLeg === 'left'
      ? "bg-blue-500/10 border-blue-500/20"
      : "bg-amber-500/10 border-amber-500/20"
  )}
  className={cn(
    "text-sm",
    stats.weakerLeg === 'left' ? "text-blue-700" : "text-amber-700"
  )}
```

### O Que NAO Muda
- Nenhuma outra parte da interface
- Logica de calculo da perna menor
- Comportamento da arvore ou busca
