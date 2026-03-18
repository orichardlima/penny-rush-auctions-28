

# Bug: Lances não descontam do saldo

## Causa raiz

O trigger `protect_profile_sensitive_fields` (migração `20260314215110`) **bloqueia silenciosamente** qualquer atualização do campo `bids_balance` feita por role diferente de `service_role`:

```sql
IF current_setting('role') != 'service_role' THEN
    NEW.bids_balance := OLD.bids_balance;  -- reverte a mudança
END IF;
```

O frontend usa o client Supabase (role `anon`/`authenticated`), então o UPDATE em `profiles.bids_balance` é **silenciosamente ignorado** — não dá erro, apenas não altera o valor. O lance é inserido na tabela `bids`, mas o saldo nunca diminui.

## Solução

Criar uma **função RPC `SECURITY DEFINER`** no banco que desconta o saldo atomicamente, e atualizar o frontend para chamá-la ao invés de fazer UPDATE direto.

### 1. Migração SQL — criar RPC `place_bid`

```sql
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  -- Verificar saldo
  SELECT bids_balance INTO v_balance
  FROM profiles WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 1 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Descontar 1 lance
  UPDATE profiles SET bids_balance = bids_balance - 1
  WHERE user_id = p_user_id;

  -- Inserir lance
  INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
  VALUES (p_auction_id, p_user_id, 1, 1.00);
END;
$$;
```

Isso executa com `service_role` internamente, contornando o trigger de proteção.

### 2. Atualizar frontend — `handleBid` em Index.tsx e Auctions.tsx

Substituir o UPDATE manual + INSERT por uma única chamada RPC:

```typescript
const { error } = await supabase.rpc('place_bid', {
  p_auction_id: auctionId,
  p_user_id: user.id
});
```

Remover o código de update de `profiles.bids_balance` e insert em `bids` — tudo é feito atomicamente pelo RPC.

### 3. Atualizar o tipo TypeScript

O arquivo `types.ts` é gerado automaticamente, mas precisamos garantir que o RPC `place_bid` seja reconhecido. Após a migração, o tipo será atualizado automaticamente.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Criar função `place_bid` |
| `src/pages/Index.tsx` | Substituir UPDATE+INSERT por `supabase.rpc('place_bid')` |
| `src/pages/Auctions.tsx` | Mesma substituição |

## Impacto

- Corrige o bug de saldo não sendo descontado
- Torna a operação **atômica** (saldo + lance na mesma transação)
- Previne race conditions (usa `FOR UPDATE` no saldo)

