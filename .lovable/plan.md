

## Correção: Tratamento de erro na exclusão de usuários

### Problema Identificado

O mecanismo de hard delete **funciona** (confirmado nos logs: "binário 11" foi deletado com sucesso). Porém, o "Binário 10" ainda existe no banco, o que indica que a exclusão dele falhou silenciosamente.

A causa raiz está no tratamento de erros do frontend: quando a edge function retorna um erro no corpo da resposta (ex: `{ error: "User not found" }` com HTTP 404), o `supabase.functions.invoke` **não lança exceção** -- apenas popula o campo `data` com o corpo da resposta. O código atual só verifica `error` (erro de rede), mas não verifica `data.error` (erro lógico retornado pela edge function). Resultado: o toast mostra "sucesso" mesmo quando a exclusão falhou.

### Solução

Ajustar a função `deleteUser` em `AdminUserManagement.tsx` para verificar **também** o campo `data.error` retornado pela edge function.

### Detalhes Técnicos

**Arquivo:** `src/components/AdminUserManagement.tsx` (função `deleteUser`, linhas 156-189)

Alterar o bloco de tratamento de resposta para:

```typescript
const deleteUser = async () => {
  setLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId: user.user_id },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });

    if (error) throw error;

    // NOVO: verificar erro lógico retornado pela edge function
    if (data?.error) {
      throw new Error(data.error);
    }

    if (data?.warning) {
      console.warn('Delete warning:', data.warning);
    }

    toast({
      title: "Sucesso",
      description: "Usuário deletado permanentemente com sucesso"
    });

    onUserUpdated();
  } catch (error: any) {
    console.error('Error deleting user:', error);
    toast({
      title: "Erro ao deletar",
      description: error.message || "Erro ao deletar usuário. Tente novamente.",
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};
```

A unica mudanca e adicionar a verificacao `if (data?.error) throw new Error(data.error);` na linha 169, para que erros logicos da edge function sejam tratados corretamente e exibidos ao admin.

### Resultado Esperado

- Se a exclusao falhar por qualquer motivo (usuario nao encontrado, erro de FK, etc.), o admin vera a mensagem de erro real
- Se a exclusao for bem-sucedida, o usuario sera removido e a lista atualizada
- Para o "Binario 10" especificamente: basta clicar novamente no botao de deletar -- agora qualquer erro sera exibido claramente
