-- Primeiro, remover todos os triggers que dependem da função
DROP TRIGGER IF EXISTS lock_finished_auctions_trigger ON public.auctions;
DROP TRIGGER IF EXISTS auction_lock_finished_trigger ON public.auctions;

-- Agora remover a função problemática com CASCADE para limpar dependências
DROP FUNCTION IF EXISTS public.lock_finished_auctions() CASCADE;

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