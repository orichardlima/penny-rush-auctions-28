-- Desabilitar o trigger problemático que estava causando erro na reativação
DROP TRIGGER IF EXISTS lock_finished_auctions_trigger ON public.auctions;

-- Remover a função que causava problemas com auth.uid()
DROP FUNCTION IF EXISTS public.lock_finished_auctions();

-- Criar policy RLS específica para controlar reativação de leilões
CREATE POLICY "Only admins can reactivate finished auctions" 
ON public.auctions 
FOR UPDATE 
USING (
  -- Permitir atualização se for admin OU se não for uma reativação (leilão não finalizado)
  is_admin_user(auth.uid()) OR status != 'finished'
)
WITH CHECK (
  -- Verificar se é admin quando tentando reativar (mudando de finished para active)
  is_admin_user(auth.uid()) OR 
  (OLD.status != 'finished' OR NEW.status = 'finished')
);

-- Log da mudança para auditoria
COMMENT ON POLICY "Only admins can reactivate finished auctions" ON public.auctions IS 
'Permite que apenas administradores reativem leilões finalizados, mantendo outras atualizações livres';