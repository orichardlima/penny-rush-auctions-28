-- Corrigir URLs malformadas de imagens
UPDATE auctions 
SET image_url = REPLACE(image_url, '.jpg.og.jpg', '.jpg')
WHERE image_url LIKE '%.jpg.og.jpg%';

UPDATE auctions 
SET image_url = REPLACE(image_url, '.png.og.png', '.png')
WHERE image_url LIKE '%.png.og.png%';

UPDATE auctions 
SET image_url = REPLACE(image_url, '.jpeg.og.jpeg', '.jpeg')
WHERE image_url LIKE '%.jpeg.og.jpeg%';