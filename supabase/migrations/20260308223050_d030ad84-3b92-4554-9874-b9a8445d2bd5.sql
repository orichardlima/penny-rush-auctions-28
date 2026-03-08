
-- 1. Fix PS5 SLIM (b4dc6af8) - finished with real winner, assign bot Alice Guimarães
UPDATE auctions SET
  winner_id = '7a24e246-ba11-4bc4-ae4c-cacc7457a266',
  winner_name = 'Ali*** Gui******* - Cariacica, ES'
WHERE id = 'b4dc6af8-97c4-4fcb-9e7b-7e5154e30670';

-- 2. Fix JBL Tune (556cee8b) - finished with real winner, assign bot Ailton Nobre
UPDATE auctions SET
  winner_id = '58e3d9b6-943b-48aa-a52a-b551bc800b32',
  winner_name = 'Ail*** Nob** - Belém, PA'
WHERE id = '556cee8b-2164-40a8-b676-85fa793eae45';

-- 3. Suspend active JBL Tune (5799ccfa) - assign bot Matheus Freitas
UPDATE auctions SET
  status = 'finished',
  finished_at = now(),
  winner_id = '402816af-d65c-4ded-9fc4-0ce0951712ac',
  winner_name = 'Mat**** Fre**** - Uberlândia, MG'
WHERE id = '5799ccfa-c536-4832-be20-e510694b4f78';

-- 4. Suspend waiting PS5 SLIM (400864f8) - assign bot Lucia Oliveira
UPDATE auctions SET
  status = 'finished',
  finished_at = now(),
  winner_id = '1417d4a6-dd60-4022-a67d-403b1aff0b70',
  winner_name = 'Luc** Oli***** - Belém, PA'
WHERE id = '400864f8-46d1-4273-b59a-76db549723fc';

-- 5. Suspend waiting Lenovo (267887b6) - assign bot Carlos Souza
UPDATE auctions SET
  status = 'finished',
  finished_at = now(),
  winner_id = '8192dfac-02be-4bb2-87b4-eb3784edadd2',
  winner_name = 'Car*** Sou** - Contagem, MG'
WHERE id = '267887b6-5793-4c4f-be47-2328f58986aa';
