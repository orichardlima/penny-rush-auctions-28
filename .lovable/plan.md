# Reaproveitar as imagens do catálogo de leilões na Loja de Pontos

Os 3 produtos da loja estão sem imagem, mas o catálogo de leilões (`product_templates`) já tem itens equivalentes com imagem, marca e modelo.

## Correspondência encontrada

| Produto da loja | Item do catálogo de leilões |
| --- | --- |
| Fone Bluetooth | Fone JBL Tune 510BT |
| Caixa de Som Bluetooth | Caixa de Som Bluetooth 10W |
| PlayStation 5 Slim | PlayStation 5 SLIM |

## O que será feito

1. Copiar a imagem de cada template correspondente para o produto da loja:
   - preencher `main_image_url`
   - criar o registro em `points_store_item_images` como imagem principal (mesma estrutura do upload manual)
2. Preencher marca/modelo dos produtos da loja a partir do título do catálogo (ex.: Fone → marca JBL, modelo Tune 510BT).
3. Adicionar no painel admin da loja um botão "Importar imagem do catálogo de leilões": abre a lista de templates, você escolhe o item e a imagem é copiada para o produto. Assim, novos prêmios não precisam de upload manual.
4. Conferir a Loja (`/loja-show`), a página do produto e "Meus Resgates" mostrando as imagens.

## Escopo técnico

- Atualização de dados apenas dos 3 produtos ativos da loja (imagem, marca, modelo).
- Uma adição de UI no admin da loja (seletor de imagem vinda do catálogo). Nada de regras de pontos, resgate ou leilão é alterado.
- O upload manual continua funcionando e sobrepõe a imagem importada.
