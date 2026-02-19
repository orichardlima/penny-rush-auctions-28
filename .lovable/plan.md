

## Naturalizar a Duracao dos Leiloes Automaticos

### Problema
A duracao dos leiloes automaticos e fixa em 3 horas (configuravel), com apenas +/-15 minutos de variacao. Isso resulta em leiloes visivelmente semelhantes (3h0min, 3h14min, 3h4min), o que pode gerar desconfianca nos usuarios.

### Solucao: Faixa de Duracao Minima e Maxima

Substituir o campo unico "Duracao (horas)" por dois campos: **Duracao Minima** e **Duracao Maxima**. O sistema sorteara uma duracao aleatoria dentro dessa faixa para cada leilao, gerando variacoes naturais.

Exemplo com min=1h e max=5h:
- Leilao A: 1h42min
- Leilao B: 4h18min
- Leilao C: 2h55min
- Leilao D: 3h37min

### Mudancas

**1. Edge Function `supabase/functions/auto-replenish-auctions/index.ts`**

- Substituir a leitura de `auto_replenish_duration_hours` por dois novos settings: `auto_replenish_duration_min_hours` e `auto_replenish_duration_max_hours`
- Calcular duracao aleatoria para cada leilao:
  ```text
  durationMs = random entre (minHours * 3600000) e (maxHours * 3600000)
  endsAt = startsAt + durationMs
  ```
- Remover o offset aleatorio de +/-15 min (ja nao e necessario pois a variacao esta embutida na faixa)

**2. Configuracoes do Sistema `src/components/SystemSettings.tsx`**

- Substituir o campo "Duracao media (horas)" por dois campos:
  - "Duracao minima (horas)" - default: 1
  - "Duracao maxima (horas)" - default: 5
- Validar que minimo < maximo

**3. Settings no banco de dados (migracao SQL)**

- Inserir dois novos registros em `system_settings`:
  - `auto_replenish_duration_min_hours` = '1'
  - `auto_replenish_duration_max_hours` = '5'
- Remover (ou manter como fallback) o antigo `auto_replenish_duration_hours`

### Resultado Esperado

Com faixa de 1h a 5h, os leiloes terao duracoes visivelmente diferentes, eliminando o padrao suspeito de "todos duram ~3 horas". Exemplo de como ficaria na tela:

```text
Leilao 1: Duracao total: 1h 42min
Leilao 2: Duracao total: 4h 18min  
Leilao 3: Duracao total: 2h 55min
Leilao 4: Duracao total: 3h 37min
```

### Arquivos Modificados
- `supabase/functions/auto-replenish-auctions/index.ts` - logica de duracao aleatoria
- `src/components/SystemSettings.tsx` - dois campos de duracao (min/max)
- Nova migracao SQL - novos settings no banco

### Impacto
- Nenhuma alteracao em leiloes ja existentes
- Nenhuma alteracao na UI de leiloes, cards, ou outras funcionalidades
- Apenas leiloes criados automaticamente apos a mudanca terao duracao variada
- O gerador de lotes manual (BatchAuctionGenerator) nao e afetado

