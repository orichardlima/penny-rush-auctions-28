-- Normalizar todos os CPFs existentes no banco (remover formatação)
UPDATE profiles 
SET cpf = regexp_replace(cpf, '\D', '', 'g') 
WHERE cpf IS NOT NULL AND cpf ~ '[^0-9]';

-- Comentário: Esta migration remove toda formatação dos CPFs existentes, 
-- deixando apenas números para garantir consistência na base de dados