-- Corrigir valores de mercado dos produtos com preços muito baixos
UPDATE auctions 
SET market_value = 
  CASE 
    WHEN title LIKE '%JBL%' OR title LIKE '%Boombox%' THEN 899.99
    WHEN title LIKE '%iPhone%' OR title LIKE '%15 Pro%' THEN 6999.99
    WHEN title LIKE '%MacBook%' OR title LIKE '%Air%' THEN 8999.99
    WHEN title LIKE '%PlayStation%' OR title LIKE '%PS5%' THEN 4299.99
    WHEN title LIKE '%Samsung%' OR title LIKE '%S24%' THEN 3999.99
    WHEN title LIKE '%Smart TV%' OR title LIKE '%55%' THEN 2299.99
    WHEN title LIKE '%Apple Watch%' OR title LIKE '%Ultra%' THEN 9999.99
    ELSE market_value
  END
WHERE market_value < 100; -- Apenas produtos com valores muito baixos