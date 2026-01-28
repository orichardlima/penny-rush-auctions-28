-- Adicionar coluna consumes_cap na tabela partner_manual_credits
ALTER TABLE public.partner_manual_credits 
ADD COLUMN consumes_cap boolean NOT NULL DEFAULT true;

-- Comentário para documentação
COMMENT ON COLUMN public.partner_manual_credits.consumes_cap IS 
'Se true, o crédito consome do teto total do parceiro. Se false, é um bônus extra.';