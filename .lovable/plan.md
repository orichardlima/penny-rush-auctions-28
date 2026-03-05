

## Plano: Edição de dados cadastrais pelo admin com audit log

### O que será feito

Adicionar um botão "Editar Cadastro" (ícone Edit/Pencil) na linha de ações do `AdminUserActions`, que abre um dialog com os campos editáveis do perfil do usuário. Ao salvar, registra no audit log os valores antigos e novos.

### Alterações

**1. AdminUserManagement.tsx — Novo dialog de edição de cadastro**

- Adicionar estado `isEditProfileDialogOpen` e estados para os campos editáveis
- Ao abrir o dialog, buscar os dados atuais do perfil (`full_name`, `cpf`, `phone`, `cep`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`)
- Renderizar formulário com todos os campos, aplicando máscaras de CPF, telefone e CEP (usando os formatters já existentes em `src/utils/validators.ts`)
- Integrar busca automática de endereço via CEP (função `fetchAddressByCEP` já existente)
- No submit: comparar valores antigos vs novos, atualizar via `supabase.from('profiles').update(...)`, registrar no audit log apenas os campos que mudaram
- Botão com ícone `Edit` posicionado junto aos demais botões de ação

### Interface do usuário

- Campos: Nome Completo, CPF, Telefone, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado
- Feedback visual de carregamento ao buscar CEP
- Toast de sucesso/erro após salvar

### Campos da interface `AdminUserActionsProps`

A interface `user` do componente precisa ser expandida para incluir os campos de endereço, ou os dados serão buscados on-demand ao abrir o dialog (preferível para não alterar a query principal). Será feita uma busca sob demanda.

### Sem alterações no banco de dados

Todos os campos já existem na tabela `profiles`. O audit log já possui a função `log_admin_action`. Nenhuma migration necessária.

