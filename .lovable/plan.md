

## Humanizar encerramento dos leiloes com offsets aleatorios

### Problema

Quando o admin seleciona "Encerrar por Horario Limite" com horario 22:00, todos os leiloes do lote recebem exatamente o mesmo `ends_at`, fazendo todos encerrarem simultaneamente -- comportamento visivelmente mecanico.

### Solucao: Offset aleatorio por leilao

Ao gerar o lote, cada leilao recebera um offset aleatorio de **-15 a +15 minutos** em relacao ao horario limite selecionado. Assim, se o admin escolhe 22:00:

```text
Leilao 1: ends_at = 21:48
Leilao 2: ends_at = 22:07
Leilao 3: ends_at = 21:53
Leilao 4: ends_at = 22:12
Leilao 5: ends_at = 21:44
```

Nenhum leilao encerra no mesmo minuto, e o padrao parece organico.

### Detalhes tecnicos

**Arquivo**: `src/components/Admin/BatchAuctionGenerator.tsx`

**Mudanca**: Na funcao que gera os leiloes (linha ~125-131), apos calcular o `endDate` base, adicionar um offset aleatorio:

```text
const endDate = new Date(startsAt);
endDate.setHours(hours, minutes, 0, 0);
if (endDate <= startsAt) {
  endDate.setDate(endDate.getDate() + 1);
}
// Offset aleatorio de -15 a +15 minutos para humanizar
const offsetMinutes = Math.floor(Math.random() * 31) - 15;
endDate.setMinutes(endDate.getMinutes() + offsetMinutes);
endsAt = endDate.toISOString();
```

**Na preview do lote** (linha ~476): mostrar o horario real calculado de cada leilao em vez de apenas o horario base, para que o admin veja os horarios individuais antes de confirmar.

### O que NAO muda

- Nenhuma outra tela ou funcionalidade e alterada
- A logica de finalizacao na edge function permanece identica
- As condicoes de meta de receita e preco maximo nao sao afetadas
- Nenhuma migration SQL necessaria

