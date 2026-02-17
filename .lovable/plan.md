
## Exclusao em Lote de Usuarios

### O que sera feito
Adicionar checkboxes na lista de usuarios para permitir selecionar varios e exclui-los de uma vez, seguindo o mesmo padrao visual ja usado na aba de Leiloes.

### Como vai funcionar
1. Cada usuario na lista tera um checkbox ao lado do nome
2. Ao selecionar um ou mais usuarios, aparecera uma barra de acoes com:
   - Contador de usuarios selecionados
   - Botao "Limpar Selecao"
   - Botao "Excluir Selecionados" (vermelho)
3. Ao clicar em "Excluir Selecionados", um dialogo de confirmacao sera exibido
4. A exclusao chamara a edge function `admin-delete-user` para cada usuario selecionado (sequencialmente, para respeitar as dependencias de FK)
5. Ao final, a lista sera atualizada automaticamente

### Detalhes Tecnicos

**Arquivo:** `src/components/AdminDashboard.tsx`

1. **Novos estados:**
   - `selectedUsers: Set<string>` - IDs dos usuarios selecionados
   - `isDeletingUsers: boolean` - flag de loading durante exclusao em lote

2. **Novas funcoes:**
   - `handleSelectUser(userId, checked)` - adiciona/remove usuario da selecao
   - `handleSelectAllUsers(checked)` - seleciona/deseleciona todos os usuarios filtrados (excluindo admins e o proprio usuario logado)
   - `deleteSelectedUsers()` - itera sobre os IDs selecionados, chama `admin-delete-user` para cada um, mostra progresso e atualiza a lista ao final

3. **Alteracoes na UI (aba Usuarios):**
   - Adicionar barra de selecao/acoes acima da lista (mesmo estilo da aba Leiloes - card laranja)
   - Adicionar checkbox em cada item da lista de usuarios
   - Protecao: usuarios admin e o proprio usuario logado nao poderao ser selecionados para exclusao

4. **Nenhuma alteracao** na edge function, no banco de dados ou em outros componentes.
