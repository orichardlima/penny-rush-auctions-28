-- Adicionar campo para rastrear bônus de cadastro
ALTER TABLE profiles ADD COLUMN signup_bonus_received boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN signup_bonus_amount numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN signup_bonus_date timestamp with time zone DEFAULT NULL;

-- Comentário: Estes campos permitirão rastrear com precisão se o usuário recebeu 
-- bônus de cadastro, o valor recebido e quando foi concedido