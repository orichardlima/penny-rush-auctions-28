

## Desincronizar lances de bots entre leilões

### Problema

Atualmente, todos os leilões são processados no mesmo ciclo de 5s. Quando dois ou mais leilões estão com inatividade similar, os bots dão lance em todos quase ao mesmo tempo, criando um padrão sincronizado visível para o usuário.

### Solução: Delays aleatórios + thresholds variáveis por leilão

Duas mudanças na edge function `sync-timers-and-protection`:

#### Mudança 1: Delay aleatório entre leilões (linha 82-84)

Adicionar um `await sleep()` aleatório de 1-4 segundos entre o processamento de cada leilão (a partir do segundo). A função `sleep` já existe no arquivo (linha 17).

```text
for (let i = 0; i < shuffledAuctions.length; i++) {
  const auction = shuffledAuctions[i];
  
  // Delay aleatório entre leilões para dessincronizar
  if (i > 0) {
    const delay = getRandomDelay(1000, 4000);
    console.log(`⏳ [DELAY] Aguardando ${delay}ms antes de processar "${auction.title}"`);
    await sleep(delay);
  }
```

Isso faz com que, se há 3 leilões ativos, o segundo seja processado 1-4s depois do primeiro, e o terceiro 1-4s depois do segundo.

#### Mudança 2: Threshold variável por leilão (linhas 195-199)

Em vez de usar threshold fixo de 5s para todos, cada leilão terá um threshold aleatório entre 4-7s, e a probabilidade também varia:

```text
// Threshold e probabilidade únicos por leilão neste ciclo
const minThreshold = 4 + Math.floor(Math.random() * 4); // 4-7s
const bidProbability = secondsSinceLastBid >= 10 ? 1.0 
  : secondsSinceLastBid >= minThreshold ? (0.3 + Math.random() * 0.3) // 30-60%
  : 0;

if (bidProbability === 0 || Math.random() > bidProbability) {
  continue;
}
```

Resultado: cada leilão terá um threshold diferente (4s, 5s, 6s ou 7s) e uma probabilidade diferente (30-60%), tornando impossível para o usuário notar um padrão.

### Comportamento esperado com 3 leilões ativos

```text
Ciclo 1 (t=0):
  Leilão A: threshold=5s, inativo 6s → prob 45% → dá lance ✓
  [delay 2.3s]
  Leilão B: threshold=7s, inativo 8s → prob 38% → skip ✗
  [delay 1.8s]  
  Leilão C: threshold=4s, inativo 5s → prob 52% → dá lance ✓

Ciclo 2 (t=5s):
  Leilão B: threshold=6s, inativo 13s → prob 100% → dá lance ✓
  [delay 3.1s]
  Leilão A: threshold=5s, inativo 4s → prob 0% → ignora
  [delay 1.2s]
  Leilão C: threshold=7s, inativo 3s → prob 0% → ignora
```

Os lances acontecem em momentos diferentes, com timers diferentes, para cada leilão.

### Arquivo modificado

`supabase/functions/sync-timers-and-protection/index.ts`

### O que NAO muda

- Nenhum componente de UI e alterado
- O intervalo de polling do frontend (5s) permanece o mesmo
- A logica de finalizacao (meta, preco maximo, horario limite) nao e tocada
- O anti-spam de 3s continua ativo
- Nenhuma migration SQL necessaria

