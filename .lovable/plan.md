## Problema
A Loja Show existe na rota `/loja-show` e funciona, mas **não há nenhum caminho visível na interface do usuário** para chegar até ela. O menu do avatar (print anexado) mostra: Meu Dashboard, Meus Pontos Show, Meus Contratos, Downloads e Sair — sem entrada para a loja. O mesmo vale para o menu mobile.

## Objetivo
Criar um acesso claro e didático à Loja Show dentro da navegação do usuário, mantendo o padrão visual atual.

## Plano de implementação

1. **Adicionar "Loja Show" no dropdown do avatar (desktop)**
   - Arquivo: `src/components/Header.tsx`
   - Inserir item entre "Meus Pontos Show" e "Meus Contratos".
   - Ícone: `ShoppingBag` (já importado no arquivo).
   - Destacar com badge "NOVO" enquanto for novidade (opcional, alinhado ao padrão usado em "Seja um Parceiro").

2. **Adicionar "Loja Show" no menu mobile**
   - Arquivo: `src/components/Header.tsx`
   - Inserir link na seção de navegação mobile, ao lado de "Meus Pontos Show".
   - Usar o mesmo ícone `ShoppingBag` e estilo dos itens existentes.

3. **Condicionar à visibilidade da loja**
   - Verificar se a loja está habilitada (`points_store_enabled = true` e `store_visible_for` retornar true para o usuário).
   - Opcionalmente, usar o hook `useStoreCatalog` ou uma consulta leve no Header para esconder o link quando a loja estiver indisponível, evitando cliques que levam à tela "Loja em breve".

4. **Testar e validar**
   - Verificar no preview: usuário logado vê "Loja Show" no menu do avatar e no menu mobile.
   - Confirmar que o link leva para `/loja-show` e que a loja carrega corretamente.
   - Confirmar que o link some ou fique desabilitado quando `points_store_enabled = false`.

## Escopo
Apenas alteração de navegação frontend. Nenhuma mudança em regras de pontos, contratos, banco ou fluxos de compra.