

# Corrigir formatacao dos nomes no trigger `last_bidders`

## Problema

O trigger `update_auction_on_bid()` esta formatando nomes como **"Oswaldo F."** (primeiro nome + inicial do sobrenome com ponto), mas a funcao original do frontend `formatUserNameForDisplay()` formata como **"Oswaldo Ferreira"** (primeiro nome + segundo nome por extenso).

Isso causou uma mudanca visual nos nomes exibidos em "Ultimos lances" nos cards de leilao.

## Causa raiz

Na migration SQL, a linha de formatacao do trigger usa:

```text
v_name_parts[1] || ' ' || left(v_name_parts[2], 1) || '.'
-- Resultado: "Oswaldo F."
```

Quando deveria usar:

```text
v_name_parts[1] || ' ' || v_name_parts[2]
-- Resultado: "Oswaldo Ferreira"
```

## Solucao

Uma unica migration SQL que:

1. Atualiza o trigger `update_auction_on_bid()` para usar o segundo nome completo (sem abreviar)
2. Faz re-backfill dos leiloes ativos/waiting para corrigir os nomes ja salvos

## Mudancas especificas

### Migration SQL (novo arquivo)

**Trigger** -- alterar a linha de formatacao de:
```text
v_name_parts[1] || ' ' || left(v_name_parts[2], 1) || '.'
```
Para:
```text
v_name_parts[1] || ' ' || v_name_parts[2]
```

**Backfill** -- mesma correcao aplicada na query de backfill, trocando a logica de abreviacao pela mesma logica de nome completo.

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| Nova migration SQL | Corrigir formatacao no trigger + re-backfill |

## Arquivos NAO modificados

- `src/contexts/AuctionRealtimeContext.tsx` -- sem mudanca
- `src/lib/utils.ts` -- sem mudanca (a funcao `formatUserNameForDisplay` ja esta correta)
- `src/components/AuctionCard.tsx` -- sem mudanca
- Nenhum componente de UI e alterado

