

# Corrigir responsividade mobile do painel Admin

## Problema

Na tela mobile, o layout do AdminDashboard transborda horizontalmente porque:
1. O header usa `flex justify-between` sem `flex-wrap`, e o título é `text-4xl` — não cabe ao lado dos botões em telas pequenas
2. Os cards de resumo e o conteúdo ficam cortados à esquerda

## Solução

Ajustar apenas o layout responsivo no `src/components/AdminDashboard.tsx`:

1. **Header** (linhas 117-133): Adicionar `flex-wrap` e reduzir o título para `text-2xl sm:text-4xl`. Os botões ficam embaixo em mobile.
2. **Cards de resumo** (linha 136): Já usa `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`, o que parece correto — mas adicionar `overflow-hidden` e garantir `min-w-0` nos cards para evitar overflow de texto.
3. **Container**: Verificar se não há overflow horizontal — adicionar `overflow-x-hidden` no wrapper principal se necessário.

### Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/components/AdminDashboard.tsx` | Ajustar classes responsivas no header, cards e container |

### Detalhes das mudanças

```text
Linha 115: adicionar overflow-x-hidden no wrapper
Linha 117: flex → flex flex-wrap gap-4
Linha 119: text-4xl → text-2xl sm:text-4xl
Linha 126: flex gap-2 → flex gap-2 w-full sm:w-auto
Linha 136: adicionar min-w-0 nos cards se necessário
```

Nenhuma funcionalidade ou workflow será alterado — apenas ajustes de CSS responsivo.

