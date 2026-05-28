# Permitir que o usuário edite seus próprios dados cadastrais

Hoje a aba **Perfil** do dashboard (`UserDashboard.tsx`) é apenas leitura. Vou transformá-la em uma área de edição, respeitando os campos que não podem ser alterados.

## O que o usuário poderá editar

- **E-mail** (com confirmação via Supabase Auth — envia link de confirmação para o novo e-mail)
- **Senha** (campo separado com senha atual + nova senha)
- **Telefone / WhatsApp**
- **Endereço completo**: CEP (com busca automática via ViaCEP, igual ao admin), Rua, Número, Complemento, Bairro, Cidade, Estado
- **Avatar** (foto de perfil — opcional, se já houver upload em uso)
- **Chave PIX** (apenas para usuários que são Afiliados ou Parceiros — já existe edição nas áreas próprias de Afiliado/Parceiro; vou apenas adicionar um atalho/link visível a partir da aba Perfil para essas telas, mantendo o fluxo atual intacto)

## O que NÃO poderá ser editado (somente leitura, com aviso)

- **Nome completo** (dado pessoal vinculado ao CPF)
- **CPF**
- **Data de nascimento**
- **Indicador / código de quem indicou**

Para alterar esses campos, o usuário verá uma mensagem orientando a abrir um chamado / falar com o suporte (admin continua podendo editar via `AdminEditProfileDialog`).

## Como vai ficar a interface

Substituir o card de leitura atual em `UserDashboard.tsx` (aba "Perfil") por um novo componente `UserProfileEditor.tsx`, dividido em 3 cards:

1. **Dados pessoais** (somente leitura): Nome, CPF, Data de nascimento + nota explicativa
2. **Dados de contato e endereço** (editáveis): E-mail, Telefone, CEP + endereço completo. Botão "Salvar alterações".
3. **Segurança**: Botão "Alterar senha" abrindo um dialog com: senha atual, nova senha, confirmar nova senha.

Se for Afiliado/Parceiro, mostrar um 4º card pequeno com link "Gerenciar chave PIX" levando para a tela existente.

## Detalhes técnicos

- Validação client-side com **zod** (e-mail, telefone BR, CEP 8 dígitos, senha mínima 8 caracteres).
- E-mail: `supabase.auth.updateUser({ email })` + atualizar `profiles.email` após confirmação. Avisar que o link de confirmação foi enviado.
- Senha: `supabase.auth.updateUser({ password })` após reautenticar com senha atual via `signInWithPassword`.
- Demais campos: `update` direto em `profiles` usando RLS já existente (usuário só consegue atualizar a própria linha).
- CEP: reaproveitar lógica do `AdminEditProfileDialog` (ViaCEP) extraindo para um hook `useCepLookup` para evitar duplicação.
- Toasts de sucesso/erro com o `useToast` já em uso.
- Sem mudanças em RLS — políticas atuais de `profiles` já permitem ao próprio usuário atualizar sua linha. Verificarei na implementação; se faltar, adiciono uma migration mínima permitindo `UPDATE` apenas dos campos liberados (via trigger que bloqueia alterações em `cpf`, `full_name`, `birth_date`) para reforçar a segurança server-side.

## Arquivos previstos

- Novo: `src/components/User/UserProfileEditor.tsx`
- Novo: `src/components/User/ChangePasswordDialog.tsx`
- Novo: `src/hooks/useCepLookup.ts` (extraído do dialog do admin)
- Editado: `src/components/UserDashboard.tsx` (aba Perfil passa a renderizar o novo componente)
- Possível migration: trigger em `profiles` bloqueando UPDATE de `cpf`, `full_name`, `birth_date` por usuários não-admin (somente se a RLS atual não restringir colunas).

Nenhuma alteração em outras áreas (leilões, parceria, afiliado, admin) — apenas a aba Perfil ganha funcionalidade.
