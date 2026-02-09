

## Correcao: Timer travando em 15 segundos

### Problema

Na linha 65 do `AuctionCard.tsx`, existe um bug logico no calculo do timer exibido:

```text
const displayTimeLeft = auctionStatus === 'active' && contextTimer > 0 ? contextTimer : initialTimeLeft;
```

Quando o `contextTimer` (calculado pelo Context centralizado) chega a **0**, a condicao `contextTimer > 0` retorna `false`, e o valor cai no fallback `initialTimeLeft`, que tem valor padrao **15**. Isso cria o seguinte ciclo:

```text
Timer: 15 -> 14 -> ... -> 1 -> 0 -> (fallback) 15 -> 14 -> ...
```

O timer nunca chega a mostrar 0, entao o estado "Verificando lances validos" (linha 76) tambem nunca e ativado, pois depende de `displayTimeLeft === 0`.

### Causa raiz

A logica de fallback foi pensada para quando o Context ainda nao carregou os dados, mas ela tambem e acionada quando o timer legitimamente chega a zero.

### Solucao

Alterar a linha 65 para tratar corretamente os tres cenarios:

1. **Context disponivel e timer > 0**: mostrar `contextTimer`
2. **Context disponivel e timer = 0**: mostrar `0` (para ativar estado "Verificando")
3. **Context nao disponivel**: usar `initialTimeLeft` como fallback

Nova logica:

```text
const displayTimeLeft = contextAuction
  ? (displayStatus === 'active' ? contextTimer : 0)
  : initialTimeLeft;
```

Quando o `contextAuction` existe (dados carregados), usa sempre o timer calculado pelo Context. Quando nao existe (fallback), usa o valor da prop.

### Detalhes tecnicos

| Arquivo | Linha | Mudanca |
|---|---|---|
| `src/components/AuctionCard.tsx` | 65 | Substituir logica do `displayTimeLeft` |

### O que NAO muda

- Nenhum outro componente e alterado
- A logica de calculo do timer no `AuctionRealtimeContext` permanece identica
- O estado "Verificando lances validos" (isVerifying) continua funcionando com a mesma condicao
- Nenhum outro visual ou funcionalidade e modificado

### Resultado esperado

- Timer conta de 15 ate 0 normalmente
- Ao chegar em 0, exibe "Verificando lances validos" corretamente
- Quando um novo lance e registrado (bot ou real), o timer reinicia a partir do valor correto
- Elimina o "travamento" visual em 15 segundos

