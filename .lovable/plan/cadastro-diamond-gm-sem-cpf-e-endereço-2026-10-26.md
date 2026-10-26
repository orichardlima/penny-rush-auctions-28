# Cadastro "Diamond GM" sem CPF e endereço

## O que aconteceu (confirmado no banco)
- Conta xbtsp2abnzz@maxxspace.com criada hoje às 01:31 (Bahia), e-mail já confirmado no mesmo instante, último acesso 01:50.
- Ela **não foi feita pela tela de cadastro do site**. Foi criada chamando o sistema de login direto, de fora do site. A tela exige CPF e endereço, mas o servidor não confere nada disso.
- O CPF enviado (510.519.618-07) já pertence a outra pessoa cadastrada, então o perfil ficou sem CPF. Endereço nem foi enviado.
- 9 minutos depois, a própria conta alterou o perfil e se marcou como "perfil completo", liberando o acesso sem preencher nada. Hoje o usuário pode alterar o próprio perfil livremente, inclusive essa marcação.
- Mais 9 contas criadas nos últimos 3 dias estão sem CPF. Mesmo padrão do ataque de ontem (nome "Diamond", telefone falso 99999-9999).

## Plano

### 1. Contenção
- Bloquear o login desta conta e listar as outras 9 sem CPF para você decidir quais bloquear (sem apagar nada).
- Conferir se essas contas criaram contrato, saque, compra ou indicação.

### 2. Fechar a brecha no servidor
- O próprio usuário não consegue mais mudar "perfil completo", CPF já gravado, saldo ou campos de controle do perfil.
- "Perfil completo" só vira verdadeiro pelo servidor quando CPF válido e único, telefone e endereço estiverem preenchidos.
- Sem perfil completo, o servidor recusa lances, compras, contrato, ativação e saque (não só a tela).
- Cadastro com CPF já existente ou inválido fica com perfil incompleto e é sinalizado.

### 3. Conferência
- Testar com uma conta comum: tentar se marcar como completo e tentar agir sem CPF devem ser recusados; cadastro normal pelo site continua funcionando.

## Detalhes técnicos
- Trigger BEFORE UPDATE em `profiles` impedindo não-admin de alterar `profile_complete`, `cpf` (quando já preenchido), e colunas sensíveis; recalcular `profile_complete` no servidor.
- `handle_new_user`: CPF inválido/duplicado → `profile_complete=false` + registro em `anti_fraud_flags`.
- Guardas server-side (`profile_complete`) nos RPCs de lance, compra e saque.
- Avaliar exigir confirmação de e-mail real (hoje confirma automaticamente).
