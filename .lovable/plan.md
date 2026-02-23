

# Corrigir produtos repetidos na reposicao automatica de leiloes

## Problema

A funcao `auto-replenish-auctions` seleciona templates aleatoriamente sem verificar quais produtos ja possuem leiloes ativos ou em espera. Isso resulta em produtos duplicados aparecendo simultaneamente na pagina inicial (como os 2 Lenovo IdeaPad Slim 3i atuais).

## Causa raiz

Na linha 86 do arquivo, os templates sao embaralhados e selecionados sem nenhum filtro:

```text
const shuffled = [...templates].sort(() => Math.random() - 0.5)
const selected = shuffled.slice(0, needed)
```

Nao ha verificacao se o template ja esta em uso em um leilao ativo/waiting.

## Solucao

Adicionar uma verificacao na Edge Function `auto-replenish-auctions` que:

1. Busca os titulos de todos os leiloes com status `active` ou `waiting`
2. Filtra os templates disponiveis, removendo aqueles cujo titulo ja esta em uso
3. Somente entao embaralha e seleciona os templates restantes

## Arquivo alterado

- `supabase/functions/auto-replenish-auctions/index.ts`

## Mudanca especifica

Apos o passo 4 (fetch de templates ativos), antes do shuffle, sera adicionada a logica:

1. Buscar os titulos dos leiloes ativos/waiting:
   ```text
   SELECT title FROM auctions WHERE status IN ('active', 'waiting')
   ```

2. Criar um Set com esses titulos

3. Filtrar os templates removendo os que ja possuem leilao ativo:
   ```text
   templates.filter(t => !activeTitles.has(t.title))
   ```

4. Se nao houver templates disponiveis apos o filtro, retornar mensagem informando que todos os templates ja estao em uso

5. Se houver menos templates disponiveis do que o necessario, criar apenas a quantidade possivel (sem duplicar)

## O que NAO muda

- Nenhuma interface (UI) sera alterada
- A logica de escalonamento de horarios permanece identica
- A logica de duracao aleatoria permanece identica
- O incremento de `times_used` permanece identico
- Todas as configuracoes do sistema continuam funcionando normalmente
- A funcao `sync-timers-and-protection` nao sera tocada

