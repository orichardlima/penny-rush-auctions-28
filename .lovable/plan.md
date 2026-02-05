
# Plano: Corrigir Timezone no Trigger do Banco

## Diagnóstico Confirmado

| Campo | Tipo | Valor Atual | Problema |
|-------|------|-------------|----------|
| `last_bid_at` | `timestamptz` | `2026-02-05 12:04:36+00` | ❌ 3h atrasado |
| `updated_at` | `timestamptz` | `2026-02-05 15:04:36+00` | ✅ Correto (UTC) |
| Diferença | - | `03:00:00` | Offset Brasil/UTC |

**Causa raiz**: O trigger `update_auction_on_bid()` faz:
```sql
current_time_br := timezone('America/Sao_Paulo', now());
-- Isso retorna timestamp SEM fuso, que ao salvar em timestamptz assume +00
```

## Solução: Migração do Banco

### Correção do Trigger

Remover a conversão `timezone('America/Sao_Paulo', now())` e usar `now()` diretamente:

```sql
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  is_bot_user boolean := false;
BEGIN
  -- Identificar se é bot (interno)
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  -- Verificar se é bot N8N ou bot interno
  IF is_bot_user OR NEW.cost_paid = 0 THEN
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      last_bid_at = now(),  -- CORRIGIDO: usar now() diretamente
      updated_at = now()
    WHERE id = NEW.auction_id;
    
    IF is_bot_user THEN
      RAISE LOG '🤖 [BID-BOT-INTERNO] Bot interno no leilão %: preço atualizado, timer resetado, SEM receita', NEW.auction_id;
    ELSE
      RAISE LOG '🤖 [BID-BOT-N8N] Bot N8N no leilão %: preço atualizado, timer resetado, SEM receita', NEW.auction_id;
    END IF;
    
  ELSE
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + NEW.cost_paid,
      time_left = 15,
      last_bid_at = now(),  -- CORRIGIDO: usar now() diretamente
      updated_at = now()
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Usuário real no leilão %: receita +R$%.2f, preço e timer atualizados', NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

### Correção dos Dados Existentes (Opcional)

Atualizar leilões ativos para corrigir o `last_bid_at` existente:

```sql
UPDATE auctions 
SET last_bid_at = last_bid_at + interval '3 hours'
WHERE status = 'active' 
AND last_bid_at IS NOT NULL;
```

## Detalhes Técnicos

### Por que `timezone('America/Sao_Paulo', now())` falha?

1. `now()` retorna `2026-02-05 15:04:36+00` (UTC)
2. `timezone('America/Sao_Paulo', now())` converte para `2026-02-05 12:04:36` (sem fuso)
3. Ao salvar em `timestamptz`, PostgreSQL assume `+00` → valor errado

### Por que `now()` funciona?

1. `now()` retorna `timestamptz` já em UTC
2. Salvar em `timestamptz` preserva o valor correto
3. Frontend calcula `deadline = last_bid_at + 15s - Date.now()` corretamente

## Arquivos Afetados

### Frontend (Nenhuma mudança necessária)
O código em `AuctionRealtimeContext.tsx` já está correto:
```typescript
const calculateTimeLeftFromFields = (status, lastBidAt, endsAt) => {
  const lastBidTime = new Date(lastBidAt).getTime();
  const bidDeadline = lastBidTime + 15000;
  // Funciona quando lastBidAt está em UTC correto
};
```

## Plano de Execução

1. **Aplicar migração**: Atualizar o trigger `update_auction_on_bid()`
2. **Corrigir dados existentes**: UPDATE nos leilões ativos
3. **Testar**: Verificar que `last_bid_at` e `updated_at` agora coincidem
4. **Validar frontend**: Timers devem funcionar imediatamente
