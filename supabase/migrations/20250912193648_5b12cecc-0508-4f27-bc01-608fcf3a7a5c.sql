-- Diversificar regiões dos bots brasileiros - distribuição nacional
DO $$
DECLARE
    cities_data JSONB := '[
        {"city": "São Paulo", "state": "SP", "cep": "01000-000", "neighborhoods": ["Centro", "Vila Madalena", "Pinheiros", "Moema", "Jardins", "Liberdade", "Bela Vista", "Consolação"]},
        {"city": "Campinas", "state": "SP", "cep": "13000-000", "neighborhoods": ["Centro", "Cambuí", "Nova Campinas", "Jardim Guanabara", "Vila Industrial"]},
        {"city": "Santos", "state": "SP", "cep": "11000-000", "neighborhoods": ["Centro", "Gonzaga", "Boqueirão", "Embaré", "Vila Belmiro"]},
        {"city": "Ribeirão Preto", "state": "SP", "cep": "14000-000", "neighborhoods": ["Centro", "Jardim Irajá", "Vila Virginia", "Campos Elíseos"]},
        {"city": "Sorocaba", "state": "SP", "cep": "18000-000", "neighborhoods": ["Centro", "Vila Hortência", "Jardim Vergueiro", "Vila Carvalho"]},
        {"city": "Rio de Janeiro", "state": "RJ", "cep": "20000-000", "neighborhoods": ["Copacabana", "Ipanema", "Leblon", "Botafogo", "Flamengo", "Centro", "Tijuca", "Barra da Tijuca"]},
        {"city": "Niterói", "state": "RJ", "cep": "24000-000", "neighborhoods": ["Icaraí", "Santa Rosa", "São Francisco", "Centro", "Ingá"]},
        {"city": "Nova Iguaçu", "state": "RJ", "cep": "26000-000", "neighborhoods": ["Centro", "Vila de Cava", "Austin", "Rancho Novo"]},
        {"city": "Duque de Caxias", "state": "RJ", "cep": "25000-000", "neighborhoods": ["Centro", "Jardim Primavera", "Vila São Luís", "Pilar"]},
        {"city": "Belo Horizonte", "state": "MG", "cep": "30000-000", "neighborhoods": ["Savassi", "Centro", "Funcionários", "Santo Antônio", "Lourdes", "Anchieta"]},
        {"city": "Uberlândia", "state": "MG", "cep": "38000-000", "neighborhoods": ["Centro", "Martins", "Santa Mônica", "Tibery", "Jardim Brasília"]},
        {"city": "Juiz de Fora", "state": "MG", "cep": "36000-000", "neighborhoods": ["Centro", "São Mateus", "Santa Helena", "Cascatinha"]},
        {"city": "Contagem", "state": "MG", "cep": "32000-000", "neighborhoods": ["Centro", "Eldorado", "Industrial", "Nacional"]},
        {"city": "Vitória", "state": "ES", "cep": "29000-000", "neighborhoods": ["Centro", "Praia do Canto", "Jardim da Penha", "Bento Ferreira"]},
        {"city": "Vila Velha", "state": "ES", "cep": "29100-000", "neighborhoods": ["Centro", "Praia da Costa", "Itaparica", "Paul"]},
        {"city": "Cariacica", "state": "ES", "cep": "29140-000", "neighborhoods": ["Centro", "Campo Grande", "Porto de Santana"]},
        {"city": "Salvador", "state": "BA", "cep": "40000-000", "neighborhoods": ["Pelourinho", "Barra", "Ondina", "Rio Vermelho", "Pituba", "Itapuã", "Campo Grande"]},
        {"city": "Feira de Santana", "state": "BA", "cep": "44000-000", "neighborhoods": ["Centro", "Kalilândia", "Tomba", "Cidade Nova"]},
        {"city": "Vitória da Conquista", "state": "BA", "cep": "45000-000", "neighborhoods": ["Centro", "Candeias", "Brasil", "Recreio"]},
        {"city": "Recife", "state": "PE", "cep": "50000-000", "neighborhoods": ["Boa Viagem", "Centro", "Espinheiro", "Graças", "Casa Forte", "Aflitos"]},
        {"city": "Jaboatão dos Guararapes", "state": "PE", "cep": "54000-000", "neighborhoods": ["Piedade", "Candeias", "Barra de Jangada", "Prazeres"]},
        {"city": "Olinda", "state": "PE", "cep": "53000-000", "neighborhoods": ["Centro Histórico", "Casa Caiada", "Rio Doce", "Bairro Novo"]},
        {"city": "Fortaleza", "state": "CE", "cep": "60000-000", "neighborhoods": ["Meireles", "Iracema", "Centro", "Aldeota", "Cocó", "Papicu"]},
        {"city": "Caucaia", "state": "CE", "cep": "61600-000", "neighborhoods": ["Centro", "Jurema", "Parque Soledade"]},
        {"city": "Juazeiro do Norte", "state": "CE", "cep": "63000-000", "neighborhoods": ["Centro", "Lagoa Seca", "Pirajá", "São Miguel"]},
        {"city": "João Pessoa", "state": "PB", "cep": "58000-000", "neighborhoods": ["Centro", "Tambaú", "Cabo Branco", "Manaíra"]},
        {"city": "Natal", "state": "RN", "cep": "59000-000", "neighborhoods": ["Centro", "Ponta Negra", "Tirol", "Petrópolis"]},
        {"city": "Aracaju", "state": "SE", "cep": "49000-000", "neighborhoods": ["Centro", "Atalaia", "Jardins", "Treze de Julho"]},
        {"city": "Maceió", "state": "AL", "cep": "57000-000", "neighborhoods": ["Centro", "Pajuçara", "Ponta Verde", "Jatiúca"]},
        {"city": "São Luís", "state": "MA", "cep": "65000-000", "neighborhoods": ["Centro", "Calhau", "Renascença", "São Francisco"]},
        {"city": "Teresina", "state": "PI", "cep": "64000-000", "neighborhoods": ["Centro", "Jóquei", "Fátima", "Cabral"]},
        {"city": "Porto Alegre", "state": "RS", "cep": "90000-000", "neighborhoods": ["Centro", "Moinhos de Vento", "Bela Vista", "Cidade Baixa", "Menino Deus", "Mont Serrat"]},
        {"city": "Caxias do Sul", "state": "RS", "cep": "95000-000", "neighborhoods": ["Centro", "São Pelegrino", "Pioneiro", "Madureira"]},
        {"city": "Pelotas", "state": "RS", "cep": "96000-000", "neighborhoods": ["Centro", "Areal", "Fragata", "Laranjal"]},
        {"city": "Florianópolis", "state": "SC", "cep": "88000-000", "neighborhoods": ["Centro", "Trindade", "Córrego Grande", "Lagoa da Conceição"]},
        {"city": "Joinville", "state": "SC", "cep": "89200-000", "neighborhoods": ["Centro", "América", "Anita Garibaldi", "Bucarein"]},
        {"city": "Blumenau", "state": "SC", "cep": "89000-000", "neighborhoods": ["Centro", "Victor Konder", "Velha", "Garcia"]},
        {"city": "Curitiba", "state": "PR", "cep": "80000-000", "neighborhoods": ["Centro", "Batel", "Água Verde", "Bigorrilho", "Jardim Botânico"]},
        {"city": "Londrina", "state": "PR", "cep": "86000-000", "neighborhoods": ["Centro", "Jardim Higienópolis", "Vila Recreio"]},
        {"city": "Maringá", "state": "PR", "cep": "87000-000", "neighborhoods": ["Centro", "Zona 7", "Jardim Alvorada"]},
        {"city": "Brasília", "state": "DF", "cep": "70000-000", "neighborhoods": ["Asa Norte", "Asa Sul", "Lago Norte", "Lago Sul", "Sudoeste", "Noroeste"]},
        {"city": "Taguatinga", "state": "DF", "cep": "72000-000", "neighborhoods": ["Centro", "Águas Claras", "Vicente Pires"]},
        {"city": "Goiânia", "state": "GO", "cep": "74000-000", "neighborhoods": ["Centro", "Setor Oeste", "Marista", "Bueno", "Nova Suiça"]},
        {"city": "Aparecida de Goiânia", "state": "GO", "cep": "74900-000", "neighborhoods": ["Centro", "Cidade Livre", "Jardim Olímpico"]},
        {"city": "Cuiabá", "state": "MT", "cep": "78000-000", "neighborhoods": ["Centro", "Jardim Aclimação", "Bosque da Saúde"]},
        {"city": "Várzea Grande", "state": "MT", "cep": "78100-000", "neighborhoods": ["Centro", "Vila Arthur", "Jardim dos Estados"]},
        {"city": "Campo Grande", "state": "MS", "cep": "79000-000", "neighborhoods": ["Centro", "Jardim dos Estados", "Vila Olinda"]},
        {"city": "Dourados", "state": "MS", "cep": "79800-000", "neighborhoods": ["Centro", "Jardim América", "Vila Progresso"]},
        {"city": "Belém", "state": "PA", "cep": "66000-000", "neighborhoods": ["Centro", "Nazaré", "Batista Campos", "São Brás"]},
        {"city": "Ananindeua", "state": "PA", "cep": "67000-000", "neighborhoods": ["Centro", "Cidade Nova", "Águas Lindas"]},
        {"city": "Manaus", "state": "AM", "cep": "69000-000", "neighborhoods": ["Centro", "Adrianópolis", "Chapada", "Ponta Negra"]},
        {"city": "Parintins", "state": "AM", "cep": "69150-000", "neighborhoods": ["Centro", "Palmares", "João XXIII"]},
        {"city": "Rio Branco", "state": "AC", "cep": "69900-000", "neighborhoods": ["Centro", "Bosque", "Placas"]},
        {"city": "Porto Velho", "state": "RO", "cep": "76800-000", "neighborhoods": ["Centro", "Olaria", "Areal"]},
        {"city": "Boa Vista", "state": "RR", "cep": "69300-000", "neighborhoods": ["Centro", "São Francisco", "Mecejana"]},
        {"city": "Macapá", "state": "AP", "cep": "68900-000", "neighborhoods": ["Centro", "Jesus de Nazaré", "Trem"]},
        {"city": "Palmas", "state": "TO", "cep": "77000-000", "neighborhoods": ["Centro", "Plano Diretor Norte", "Jardim Aureny"]}
    ]'::JSONB;
    
    city_record JSONB;
    bot_record RECORD;
    random_neighborhood TEXT;
    counter INTEGER := 0;
    total_bots INTEGER;
    
BEGIN
    -- Contar total de bots
    SELECT COUNT(*) INTO total_bots FROM public.profiles WHERE is_bot = true;
    
    RAISE LOG 'Iniciando diversificação regional de % bots', total_bots;
    
    -- Atualizar cada bot com uma cidade aleatória
    FOR bot_record IN 
        SELECT user_id FROM public.profiles 
        WHERE is_bot = true 
        ORDER BY RANDOM()
    LOOP
        -- Selecionar cidade aleatória do array
        city_record := cities_data->FLOOR(RANDOM() * JSONB_ARRAY_LENGTH(cities_data))::INTEGER;
        
        -- Selecionar bairro aleatório da cidade
        random_neighborhood := (city_record->'neighborhoods'->FLOOR(RANDOM() * JSONB_ARRAY_LENGTH(city_record->'neighborhoods'))::INTEGER)#>>'{}';
        
        -- Atualizar o bot com os novos dados
        UPDATE public.profiles
        SET 
            city = city_record->>'city',
            state = city_record->>'state',
            cep = city_record->>'cep',
            neighborhood = random_neighborhood,
            updated_at = timezone('America/Sao_Paulo', now())
        WHERE user_id = bot_record.user_id;
        
        counter := counter + 1;
    END LOOP;
    
    RAISE LOG 'Diversificação concluída: % bots distribuídos por % cidades brasileiras', counter, JSONB_ARRAY_LENGTH(cities_data);
    
    -- Estatísticas finais por estado
    RAISE LOG 'Distribuição final por estados';
    
END $$;