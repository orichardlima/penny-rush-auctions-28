# Imagens dos prêmios geradas automaticamente

Sim — dá para gerar as imagens por IA e já deixá-las publicadas na loja, sem você subir nada.

## O que será feito

1. Gerar 3 imagens de produto (fundo neutro claro, estilo e-commerce, alta nitidez):
   - Fone Bluetooth
   - Caixa de Som Bluetooth
   - PlayStation 5 Slim (console genérico moderno, sem marca/logotipo)
2. Enviar os arquivos para o bucket `product-images` já usado pelo painel.
3. Registrar cada imagem como imagem principal do respectivo produto na galeria (mesma estrutura que o upload manual cria).
4. Conferir na Loja (`/loja-show`) e na página do produto que o "SEM IMAGEM" desapareceu.

## Observação importante

Imagens de IA são ilustrativas. Para o PlayStation 5 Slim, a imagem não pode reproduzir a marca real, então será um console estilizado. Recomendo trocar depois pela foto oficial do produto no painel — o fluxo de upload manual continua funcionando normalmente e sobrepõe a imagem gerada.

## Escopo técnico

- Nenhuma alteração de regra de negócio, resgate, pontos ou UI da loja.
- Somente geração de arquivos, upload no bucket e inserção dos registros de imagem dos 3 produtos ativos.
