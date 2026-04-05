

# Fix: notify_bot_bid_scheduled com fallback seguro para anon key

## Problema

A função `notify_bot_bid_scheduled()` tem a anon key hardcoded diretamente no SQL. Queremos melhorar a prática sem risco de a trigger parar de funcionar.

## Solução

Nova migration que recria `notify_bot_bid_scheduled()` com:

1. **Tentativa dinâmica**: buscar via `current_setting('supabase.anon_key', true)` (o segundo parâmetro `true` retorna NULL se não existir, sem erro)
2. **Fallback explícito**: se NULL, usar a anon key conhecida (é publishable, não é segredo)
3. **RAISE NOTICE** quando o fallback for usado, para visibilidade nos logs do Postgres
4. **URL hardcoded**: mantida nesta etapa (é pública e específica do projeto)

## SQL da migration

```sql
CREATE OR REPLACE FUNCTION public.notify_bot_bid_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anon_key text;
  v_url text := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/sync-timers-and-protection';
BEGIN
  IF NEW.scheduled_bot_bid_at IS NOT NULL 
     AND OLD.scheduled_bot_bid_at IS DISTINCT FROM NEW.scheduled_bot_bid_at THEN
    
    -- Tenta buscar dinamicamente (retorna NULL se não existir)
    v_anon_key := current_setting('supabase.anon_key', true);
    
    -- Fallback: anon key é publishable/pública, seguro manter aqui
    IF v_anon_key IS NULL OR v_anon_key = '' THEN
      RAISE NOTICE 'notify_bot_bid_scheduled: current_setting não disponível, usando fallback';
      v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k';
    END IF;
    
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('trigger', 'pg_net_bot_scheduled', 'auction_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;
```

## Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | Recria `notify_bot_bid_scheduled()` com current_setting + fallback + RAISE NOTICE |

