# Correção: erro ao ativar parceiro pelo saldo/crédito

## O que aconteceu

Ao confirmar a ativação de `testedesaldo@gmail.com`, a tela mostrou apenas "Edge Function returned a non-2xx status code", sem explicar o motivo.

Investigação:

- O usuário indicado **existe** (criado em 20/08 às 23:04, poucos segundos antes da tentativa).
- A função `sponsor-activate-partner` procura o indicado com `auth.admin.listUsers()` **sem paginação**. Essa chamada retorna apenas a primeira página (50 usuários) — como a plataforma tem muito mais usuários que isso, o e-mail não é encontrado e a função responde 400 com "Usuário indicado não encontrado".
- Os logs da função confirmam a execução sem nenhum erro interno registrado (caminho de validação 400, não exceção).
- O frontend descarta o corpo da resposta de erro, por isso aparece a mensagem genérica.

## Correções

1. **Busca do indicado por e-mail (causa raiz)**
   Trocar `listUsers()` por uma consulta direta e determinística ao e-mail informado (busca por e-mail na tabela de perfis / lookup paginado por e-mail), garantindo que qualquer usuário cadastrado seja localizado independentemente da quantidade de contas.

2. **Mensagem de erro real na tela**
   Em `SponsorActivateDialog`, ler o corpo da resposta quando a invocação falhar (FunctionsHttpError) e exibir a mensagem enviada pela função ("Crédito insuficiente", "O indicado já possui contrato ativo", etc.) em vez de "non-2xx status code".

Nada mais é alterado: regras de crédito, débito de saldo, dívidas, prazos e criação de contrato permanecem exatamente como estão.

## Detalhes técnicos

- `supabase/functions/sponsor-activate-partner/index.ts`: substituir a varredura `listUsers()` por lookup direto por e-mail (normalizado em minúsculas), mantendo as validações seguintes intactas.
- `src/components/Partner/SponsorActivateDialog.tsx`: no `catch`, extrair `error.context.json()` quando disponível para exibir a mensagem do backend.

## Verificação

- Reexecutar a ativação de `testedesaldo@gmail.com` com fonte "Crédito" e confirmar contrato ativo + dívida registrada.
- Forçar um caso inválido (e-mail inexistente) e confirmar que a mensagem específica aparece no toast.
