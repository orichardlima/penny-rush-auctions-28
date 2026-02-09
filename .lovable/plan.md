

## Correcao: Bots demorando para dar lance em leiloes longos

### Diagnostico

O timer mostra "Verificando lances validos" por periodos longos porque tres fatores se acumulam:

```text
Cenario real (pior caso com 3 leiloes ativos):

T=0s   : Ultimo lance acontece, timer comeca em 15s
T=15s  : Timer chega a 0 no frontend -> "Verificando lances validos"
T=15-30s: Esperando proxima chamada do protection (intervalo de 15s)
T+2-6s : Delay aleatorio antes de processar 2o leilao
T+2-6s : Delay aleatorio antes de processar 3o leilao
-------
Total: ate 27 segundos mostrando "Verificando" antes do bot dar lance
```

Os logs confirmam:
- Tempos de execucao: 5-12 segundos por chamada (delays consomem a maior parte)
- Delays reais registrados: 2.3s, 3.0s, 4.4s, 5.3s, 5.8s entre leiloes

### Causas raiz (3 problemas)

**1. Bot so age apos 15s de inatividade** (linha 200 do edge function)
O threshold `secondsSinceLastBid >= 15` faz o bot esperar exatamente quando o timer ja zerou. O bot deveria agir com 10s de inatividade, dando o lance quando o timer mostra ~5s.

**2. Delays aleatorios de 2-6s entre leiloes** (linhas 85-89)
Com 3 leiloes ativos, os delays somam 4-12 segundos de espera desnecessaria. Isso foi pensado para parecer "natural", mas causa atrasos visiveis.

**3. Anti-spam bloqueia por 5 segundos** (linha 210)
A janela anti-spam de 5s combinada com os delays pode fazer um leilao perder sua vez.

### Solucao

#### Arquivo 1: `supabase/functions/sync-timers-and-protection/index.ts`

**Mudanca A**: Reduzir threshold do bot de 15s para 10s (linha 200)

De:
```text
if (secondsSinceLastBid >= 15) {
```
Para:
```text
if (secondsSinceLastBid >= 10) {
```

**Mudanca B**: Remover delays aleatorios entre leiloes (linhas 84-89)

Remover completamente o bloco:
```text
if (i > 0) {
  const randomDelay = getRandomDelay(2000, 6000);
  console.log(...);
  await sleep(randomDelay);
}
```

**Mudanca C**: Reduzir anti-spam de 5s para 3s (linha 210)

De:
```text
.gte('created_at', new Date(Date.now() - 5000).toISOString())
```
Para:
```text
.gte('created_at', new Date(Date.now() - 3000).toISOString())
```

#### Arquivo 2: `src/hooks/useRealTimeProtection.ts`

**Mudanca D**: Reduzir intervalo de chamada de 15s para 10s (linha 33)

De:
```text
intervalRef.current = setInterval(callProtectionSystem, 15000);
```
Para:
```text
intervalRef.current = setInterval(callProtectionSystem, 10000);
```

### Resultado esperado

Antes (pior caso):
```text
Timer: 15 -> 14 -> ... -> 1 -> 0 -> "Verificando" (ate 27 segundos)
```

Depois:
```text
Timer: 15 -> 14 -> ... -> 6 -> 5 -> (bot da lance) -> 15 -> 14 -> ...
```

- Bots dao lance quando o timer mostra ~5 segundos (10s de inatividade)
- Sem delays de processamento, a execucao cai de 5-12s para menos de 1s
- O timer quase nunca chega a 0, eliminando o "Verificando lances validos" na maioria dos casos
- Intervalo de verificacao reduzido para 10s garante resposta mais rapida

### O que NAO muda

- Nenhum componente de interface e alterado
- A logica de finalizacao por meta, preco maximo e horario limite permanece identica
- O calculo do timer no frontend (AuctionRealtimeContext) nao e modificado
- O sistema de protecao contra prejuizo continua funcionando normalmente
- Nenhuma migration SQL e necessaria

