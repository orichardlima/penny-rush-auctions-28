-- Primeiro, remover todos os triggers que dependem da função
DROP TRIGGER IF EXISTS lock_finished_auctions_trigger ON public.auctions;
DROP TRIGGER IF EXISTS auction_lock_finished_trigger ON public.auctions;

-- Agora remover a função problemática com CASCADE para limpar dependências
DROP FUNCTION IF EXISTS public.lock_finished_auctions() CASCADE;

-- Criar policy RLS mais simples - apenas permitir que admins atualizem leilões finalizados
CREATE POLICY "Admins can update finished auctions" 
ON public.auctions 
FOR UPDATE 
USING (
  -- Permitir atualização se for admin
  is_admin_user(auth.uid())
);

-- Log da mudança para auditoria
COMMENT ON POLICY "Admins can update finished auctions" ON public.auctions IS 
'Permite que apenas administradores atualizem leilões finalizados para reativação';