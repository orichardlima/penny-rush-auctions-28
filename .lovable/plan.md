

## Adicionar opcao de duracao ativa (em horas) como alternativa ao horario limite

### Problema

Atualmente, a unica forma de configurar o encerramento por tempo e definindo um horario fixo (ex: 22:00). O admin quer tambem poder escolher **quantas horas** cada leilao ficara ativo apos iniciar.

### Solucao

Adicionar um seletor de modo dentro da opcao "Encerrar por Horario Limite", permitindo escolher entre:

- **Horario fixo** (comportamento atual): todos encerram proximo ao horario escolhido (com offset aleatorio de +/-15min)
- **Duracao ativa**: cada leilao encerra X horas apos seu proprio `startsAt` (tambem com offset aleatorio de +/-15min)

### Interface

Quando "Encerrar por Horario Limite" estiver marcado, aparecera um toggle/select para escolher o modo:

```text
[x] Encerrar por Horario Limite
    Modo: [ Horario fixo v ] / [ Duracao ativa v ]
    
    Se "Horario fixo":  [ 22:00 v ]
    Se "Duracao ativa":  [ 2 horas v ]
```

### Opcoes de duracao

- 1 hora, 2 horas, 3 horas, 4 horas, 6 horas, 8 horas, 12 horas

### Logica de calculo

No `scheduledAuctions` memo, quando o modo for "duracao":

```text
// Modo duracao: ends_at = startsAt + duracaoHoras + offset aleatorio
const endDate = addMinutes(startsAt, durationHours * 60);
const offsetMinutes = Math.floor(Math.random() * 31) - 15;
endDate.setMinutes(endDate.getMinutes() + offsetMinutes);
endsAt = endDate;
```

Exemplo com duracao de 2 horas e leiloes iniciando escalonados:
```text
Leilao 1: inicio 10:00 → encerra ~12:08
Leilao 2: inicio 10:30 → encerra ~12:22
Leilao 3: inicio 11:00 → encerra ~12:47
```

### Detalhes tecnicos

**Arquivo**: `src/components/Admin/BatchAuctionGenerator.tsx`

**Novos estados**:
- `timeLimitMode`: `'fixed'` | `'duration'` (default: `'fixed'`)
- `durationHours`: number (default: 2)

**Constante**: `DURATION_OPTIONS` com as opcoes de horas

**Mudancas no `scheduledAuctions` memo**: adicionar branch para modo `'duration'` que calcula `endsAt` como `startsAt + durationHours * 60 minutos + offset`

**Mudancas na UI**: dentro do bloco `enableTimeLimit`, adicionar um Select para o modo e renderizar condicionalmente o seletor de horario fixo ou o seletor de duracao

**Preview**: ja funciona automaticamente pois usa o `endsAt` calculado no memo

### O que NAO muda

- Nenhum outro componente ou pagina e alterado
- A logica de finalizacao na edge function permanece identica
- O offset aleatorio de +/-15min continua aplicado em ambos os modos
- Nenhuma migration SQL necessaria

