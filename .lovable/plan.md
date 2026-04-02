

# Ajustar Formatação de Participantes ≥ 1000

## Alteração

### `src/components/AuctionCard.tsx`

Atualizar a lógica de formatação para que valores ≥ 1000 também arredondem para centena inferior com prefixo "+", igual ao range 100–999:

```typescript
const formatParticipants = (count: number) => {
  if (count < 100) return `${count}`;
  return `+${Math.floor(count / 100) * 100}`;
};
```

Exemplos: 1432 → "+1400", 2560 → "+2500", 728 → "+700"

Também remover o bloco "⏳ Pode encerrar a qualquer momento" (~linhas 296-301).

### Nenhum outro arquivo alterado

