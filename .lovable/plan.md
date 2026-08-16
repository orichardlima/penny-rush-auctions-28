# Imagens reais dos prêmios (buscadas na internet)

Em vez de gerar por IA, vou buscar fotos reais dos produtos (com marca) e publicá-las na loja automaticamente.

## O que será feito

1. Buscar na internet a imagem oficial/divulgação de cada um dos 3 produtos ativos:
   - Fone Bluetooth
   - Caixa de Som Bluetooth
   - PlayStation 5 Slim
2. Baixar as imagens em boa resolução (fundo branco/produto isolado quando disponível).
3. Enviar para o bucket `product-images` já usado pelo painel.
4. Registrar cada imagem como imagem principal do produto (mesma estrutura criada pelo upload manual).
5. Conferir na Loja (`/loja-show`) e na página do produto que o "SEM IMAGEM" desapareceu.

## Ponto a confirmar

Os produtos "Fone Bluetooth" e "Caixa de Som Bluetooth" estão cadastrados sem marca/modelo. Para pegar a foto certa, preciso saber o modelo real de cada um (ex.: JBL Tune 520BT, JBL Go 4). Se você não indicar, uso um modelo popular equivalente e você troca depois pelo painel.

Observação: imagens de fabricantes/lojistas têm direitos de imagem; o uso aqui é para exibição do prêmio na loja.

## Escopo técnico

- Nenhuma alteração de regra de negócio, resgate, pontos ou UI da loja.
- Somente download das imagens, upload no bucket e inserção dos registros de imagem dos 3 produtos.
