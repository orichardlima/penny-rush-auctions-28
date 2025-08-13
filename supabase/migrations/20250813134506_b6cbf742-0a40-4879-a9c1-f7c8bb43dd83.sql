-- ===================================================================
-- LIMPEZA COMPLETA: REMOVENDO TODOS OS TRIGGERS E FUNCTIONS DUPLICADOS
-- ===================================================================

-- 1. REMOVER TODOS OS TRIGGERS DUPLICADOS DA TABELA AUCTIONS
DROP TRIGGER IF EXISTS auction_status_webhook_trigger ON public.auctions;
DROP TRIGGER IF EXISTS finalize_auction_trigger ON public.auctions;
DROP TRIGGER IF EXISTS set_auction_end_time_trigger ON public.auctions;
DROP TRIGGER IF EXISTS tr_auctions_before_update_lock_finished ON public.auctions;
DROP TRIGGER IF EXISTS tr_auctions_set_updated_at ON public.auctions;
DROP TRIGGER IF EXISTS tr_finalize_auction_on_timer_zero ON public.auctions;
DROP TRIGGER IF EXISTS trg_auctions_activation_webhook ON public.auctions;
DROP TRIGGER IF EXISTS trg_auctions_finalize_on_zero ON public.auctions;
DROP TRIGGER IF EXISTS trg_auctions_lock_finished ON public.auctions;
DROP TRIGGER IF EXISTS trg_auctions_set_end_time ON public.auctions;
DROP TRIGGER IF EXISTS trg_auctions_updated_at ON public.auctions;
DROP TRIGGER IF EXISTS trg_lock_finished_auctions ON public.auctions;
DROP TRIGGER IF EXISTS trigger_auction_webhook_trigger ON public.auctions;
DROP TRIGGER IF EXISTS trigger_finalize_auction_on_timer_zero ON public.auctions;
DROP TRIGGER IF EXISTS update_auctions_updated_at ON public.auctions;

-- 2. REMOVER FUNCTIONS PROBLEMÁTICAS (mantendo apenas as essenciais)
DROP FUNCTION IF EXISTS public.finalize_auction_on_timer_zero() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_auctions() CASCADE;
DROP FUNCTION IF EXISTS public.update_auction_timers() CASCADE;

-- ===================================================================
-- IMPLEMENTAÇÃO DEFINITIVA: WEBHOOK ÚNICO
-- ===================================================================

-- Function para webhook único - SEM DUPLICATAS
CREATE OR REPLACE FUNCTION public.auction_webhook_unique()
RETURNS TRIGGER AS $$
DECLARE
  webhook_already_sent boolean := false;
BEGIN
  -- Apenas dispara se mudou de 'waiting' para 'active'
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
    
    -- Verificar se já foi enviado webhook recentemente (último minuto)
    SELECT EXISTS(
      SELECT 1 FROM public.bot_webhook_logs 
      WHERE auction_id = NEW.id 
      AND created_at > NOW() - INTERVAL '1 minute'
      AND status = 'success'
    ) INTO webhook_already_sent;
    
    -- Só enviar se não foi enviado recentemente
    IF NOT webhook_already_sent THEN
      
      -- Chamar Edge Function de forma assíncrona
      PERFORM net.http_post(
        url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/auction-webhook',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
        ),
        body := jsonb_build_object('auction_id', NEW.id::text)
      );
      
      RAISE LOG '🚀 WEBHOOK ÚNICO disparado para leilão %', NEW.id;
    ELSE
      RAISE LOG '⚠️ WEBHOOK já foi enviado para leilão % - BLOQUEADO', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- IMPLEMENTAÇÃO DEFINITIVA: ENCERRAMENTO AUTOMÁTICO
-- ===================================================================

-- Function para encerramento automático baseado em inatividade
CREATE OR REPLACE FUNCTION public.auto_finalize_inactive_auctions()
RETURNS void AS $$
DECLARE
  auction_record record;
  utc_now timestamptz;
  last_bid_time timestamptz;
  seconds_inactive integer;
BEGIN
  utc_now := NOW();
  
  RAISE LOG '🔍 [AUTO-FINALIZE] Iniciando verificação de leilões inativos';
  
  -- Buscar leilões ativos
  FOR auction_record IN 
    SELECT id, title, updated_at, status
    FROM public.auctions 
    WHERE status = 'active'
  LOOP
    
    -- Buscar último lance
    SELECT MAX(created_at) INTO last_bid_time
    FROM public.bids 
    WHERE auction_id = auction_record.id;
    
    -- Se não há lances, usar updated_at (quando virou active)
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
    END IF;
    
    -- Calcular segundos de inatividade
    seconds_inactive := EXTRACT(EPOCH FROM (utc_now - last_bid_time))::integer;
    
    RAISE LOG '🎯 [AUTO-FINALIZE] Leilão %: % segundos de inatividade', 
      auction_record.id, seconds_inactive;
    
    -- Se passou 15+ segundos, encerrar
    IF seconds_inactive >= 15 THEN
      
      DECLARE
        winner_user_id uuid;
        winner_name text;
      BEGIN
        -- Encontrar ganhador (último lance)
        SELECT b.user_id, p.full_name
        INTO winner_user_id, winner_name
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = auction_record.id
        ORDER BY b.created_at DESC
        LIMIT 1;
        
        -- Definir nome do ganhador
        IF winner_name IS NOT NULL AND trim(winner_name) != '' THEN
          winner_name := winner_name;
        ELSIF winner_user_id IS NOT NULL THEN
          winner_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
        ELSE
          winner_name := 'Nenhum ganhador';
        END IF;
        
        -- ENCERRAR LEILÃO
        UPDATE public.auctions
        SET 
          status = 'finished',
          time_left = 0,
          winner_id = winner_user_id,
          winner_name = winner_name,
          finished_at = utc_now,
          updated_at = utc_now
        WHERE id = auction_record.id;
        
        RAISE LOG '✅ [AUTO-FINALIZE] Leilão % ENCERRADO! Ganhador: % (% segundos inativo)', 
          auction_record.id, winner_name, seconds_inactive;
      END;
      
    END IF;
    
  END LOOP;
  
  RAISE LOG '🏁 [AUTO-FINALIZE] Verificação concluída';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- APLICAR TRIGGERS ÚNICOS
-- ===================================================================

-- TRIGGER ÚNICO para webhook (sem duplicatas)
CREATE TRIGGER auction_webhook_unique_trigger
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.auction_webhook_unique();

-- TRIGGER para definir end_time quando vira active
CREATE TRIGGER auction_set_end_time_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_auction_end_time();

-- TRIGGER para atualizar updated_at
CREATE TRIGGER auction_updated_at_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- TRIGGER para prevenir alteração de leilões finalizados
CREATE TRIGGER auction_lock_finished_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_finished_auctions();

-- ===================================================================
-- LOGS DE CONFIRMAÇÃO
-- ===================================================================

DO $$
BEGIN
  RAISE LOG '🧹 LIMPEZA COMPLETA: Todos os triggers duplicados removidos';
  RAISE LOG '🎯 WEBHOOK ÚNICO: Implementado com controle de duplicatas';
  RAISE LOG '⏰ AUTO-FINALIZE: Function criada para encerramento automático';
  RAISE LOG '✅ SISTEMA DEFINITIVO: Pronto para testes';
END $$;