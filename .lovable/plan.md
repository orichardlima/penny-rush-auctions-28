

# Corrigir Flickering do Rendimento Semanal no PartnerDetailModal

## Diagnóstico

O hook `useCurrentWeekRevenue` faz polling a cada 15 segundos (linha 146-148). A cada poll, ele executa `setLoading(true)` e `setIsAnimating(false)` (linhas 87-88), o que causa o componente alternar entre o spinner de loading e as barras — gerando o efeito de piscar.

Além disso, os console logs mostram "Failed to fetch" repetidos, indicando que quando o modal é aberto para múltiplos parceiros ou a conexão oscila, o hook fica em loop de erro recriando o estado.

## Solução

### `src/hooks/useCurrentWeekRevenue.ts`

1. **Separar loading inicial de refresh**: Usar uma flag `isInitialLoad` via `useRef`. Só setar `setLoading(true)` na primeira chamada. Nos polls subsequentes, manter os dados existentes visíveis enquanto busca novos.

2. **Não resetar `isAnimating` no polling**: Remover `setIsAnimating(false)` das chamadas de refresh (apenas setar na carga inicial).

3. **Tratar erro silenciosamente no polling**: Se já temos dados carregados e o fetch falha, manter os dados antigos sem logar erro repetidamente.

Alterações concretas:
- Adicionar `const isFirstLoad = useRef(true)` 
- Na `fetchData`: só `setLoading(true)` e `setIsAnimating(false)` se `isFirstLoad.current === true`
- Após carregar com sucesso, setar `isFirstLoad.current = false`
- No `catch`: só logar erro se `isFirstLoad.current`
- Resetar `isFirstLoad` quando `contract` mudar

### Nenhum outro arquivo alterado

