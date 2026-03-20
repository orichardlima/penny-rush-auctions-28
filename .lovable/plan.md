

# Fix: Leilões ganhos não aparecem para o usuário

## Diagnóstico

O usuário **Paulo Mota** arrematou o leilão "Lenovo IdeaPad Slim 3i" e tem um pedido com status `paid` na tabela `orders`. Porém, o `winner_id` do leilão foi alterado para outro usuário (Valdir Vargas), provavelmente via painel admin.

O componente `AuctionHistory` determina vitórias comparando `auctions.winner_id` com o `user_id` do usuário logado. Como o `winner_id` foi alterado, Paulo não vê mais sua vitória.

**Tabela `orders` é a fonte de verdade** -- se existe um pedido `paid` para o usuário, ele ganhou aquele leilão.

## Problemas encontrados

1. **AuctionHistory.tsx**: Usa `auctions.winner_id` para determinar vitórias -- frágil se o winner_id mudar
2. **UserDashboard.tsx**: Card "Vitórias" está hardcoded como `0` (linha 244) -- nunca mostra vitórias reais
3. **Dados inconsistentes**: Leilão `82b0a664` tem `winner_id` apontando para Valdir Vargas, mas Paulo Mota tem um pedido `paid`

## Plano de correção

### 1. Corrigir AuctionHistory.tsx
- Além de verificar `auctions.winner_id`, também buscar na tabela `orders` os leilões que o usuário ganhou (por `winner_id` na orders)
- Cruzar os dados: se existe um order com `winner_id = user_id`, marcar como "Ganho" independente do `auctions.winner_id`

### 2. Corrigir card "Vitórias" no UserDashboard.tsx
- Buscar contagem real de pedidos do usuário via `orders` table (excluindo cancelled)
- Substituir o `0` hardcoded pelo valor real

### 3. Correção de dados (migration)
- Verificar se o leilão precisa ter o winner_id corrigido, ou se a alteração foi intencional
- Como não há audit log da mudança, vamos manter os dados como estão e confiar na tabela `orders` como fonte de verdade

## Detalhes técnicos

**AuctionHistory.tsx** -- No `processAuctionData`, além de `bid.auctions.winner_id === profile.user_id`, adicionar consulta prévia:
```sql
SELECT auction_id FROM orders WHERE winner_id = user_id
```
Usar esse Set de `auction_id`s para determinar vitórias.

**UserDashboard.tsx** -- No `fetchUserData`, adicionar query:
```sql
SELECT count(*) FROM orders WHERE winner_id = user_id AND status != 'cancelled'
```
Usar resultado no card "Vitórias".

