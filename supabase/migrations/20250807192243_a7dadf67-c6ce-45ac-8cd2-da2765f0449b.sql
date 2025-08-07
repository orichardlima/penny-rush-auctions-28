-- Corrigir todos os bots com informações NULL
-- Primeiro, vamos criar um array de nomes brasileiros
DO $$
DECLARE
    nomes_brasileiros TEXT[] := ARRAY[
        'Ana Silva', 'Carlos Santos', 'Maria Oliveira', 'João Pereira', 'Fernanda Costa',
        'Pedro Almeida', 'Juliana Lima', 'Roberto Souza', 'Camila Rodrigues', 'Marcos Ferreira',
        'Larissa Martins', 'Diego Ribeiro', 'Beatriz Carvalho', 'Lucas Gomes', 'Natália Barbosa',
        'Thiago Nascimento', 'Gabriela Rocha', 'Rafael Moreira', 'Isabella Torres', 'André Cardoso',
        'Vitória Campos', 'Gustavo Correia', 'Sophia Araújo', 'Leonardo Teixeira', 'Nicole Reis',
        'Matheus Freitas', 'Yasmin Castro', 'Caio Pinto', 'Letícia Vieira', 'Felipe Alves',
        'Marina Santos', 'Bruno Dias', 'Eduarda Lopes', 'Henrique Cruz', 'Stephanie Nunes',
        'Daniel Mendes', 'Giovanna Ramos', 'Vinícius Azevedo', 'Amanda Cunha', 'Arthur Monteiro',
        'Isadora Farias', 'Gabriel Barros', 'Manuela Caldeira', 'Ryan Miranda', 'Melissa Tavares',
        'Samuel Duarte', 'Pietra Melo', 'Enzo Cardoso', 'Helena Viana', 'Davi Machado',
        'Valentina Siqueira', 'Lorenzo Nogueira', 'Alice Moura', 'Benjamín Cavalcanti', 'Clara Andrade',
        'Nicolas Batista', 'Lara Fernandes', 'Murilo Rezende', 'Emanuelly Castro', 'Anthony Peixoto',
        'Cecília Borges', 'Noah Fonseca', 'Esther Silveira', 'Miguel Teixeira', 'Sarah Coelho',
        'Theo Correia', 'Lívia Aragão', 'Isaac Cordeiro', 'Luna Paiva', 'Caleb Moraes',
        'Sophie Vargas', 'Gael Campos', 'Maitê Rocha', 'Ravi Medeiros', 'Catarina Freitas'
    ];
    nome_atual TEXT;
    email_atual TEXT;
    contador INTEGER := 1;
    bot_record RECORD;
BEGIN
    -- Iterar sobre todos os bots com informações NULL
    FOR bot_record IN 
        SELECT user_id 
        FROM public.profiles 
        WHERE is_bot = true 
        AND (full_name IS NULL OR email IS NULL)
    LOOP
        -- Selecionar um nome do array
        nome_atual := nomes_brasileiros[((contador - 1) % array_length(nomes_brasileiros, 1)) + 1];
        
        -- Criar email baseado no nome
        email_atual := lower(replace(nome_atual, ' ', '.')) || '.bot@leilao.com';
        
        -- Atualizar o bot
        UPDATE public.profiles 
        SET 
            full_name = nome_atual,
            email = email_atual,
            bids_balance = COALESCE(bids_balance, 1000000000),
            updated_at = now()
        WHERE user_id = bot_record.user_id;
        
        -- Incrementar contador
        contador := contador + 1;
        
        RAISE LOG 'Bot atualizado: % -> %', bot_record.user_id, nome_atual;
    END LOOP;
    
    RAISE LOG 'Todos os bots com informações NULL foram corrigidos. Total: %', contador - 1;
END $$;