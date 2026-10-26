# Segurança contra cadastros falsos, pagamentos e ativações falsas

## O que já está feito em produção (camadas de proteção)

### Camada 1 – Cadastro (porta de entrada)
- O servidor só cria conta com nome, CPF válido (dígitos conferidos) e não repetido, telefone, data de nascimento, endereço completo e aceite do contrato. Testado: cadastro sem CPF e com CPF repetido foram recusados.
- Cadastro pelo Google bloqueado no servidor, e o botão saiu do site.
- Contas novas sem dados completos já entram como "perfil incompleto".

### Camada 2 – Perfil
- O usuário não consegue mais se marcar como "perfil completo" sozinho. Testado: recusado.
- O próprio usuário não altera saldo, administrador, bloqueio, bônus de cadastro nem o CPF já gravado.

### Camada 3 – Contratos (ativações falsas)
- Usuário comum não cria contrato ativo nem altera plano, valor ou status. Testado: recusado ou sem efeito.
- Contrato só nasce por pagamento PIX confirmado, ativação por saldo/crédito ou ação do admin.
- Corrigida a falha que fazia as travas do banco acharem que qualquer um era "privilegiado".

### Camada 4 – Saques (pagamentos falsos)
- Usuário comum não grava saque direto nem escolhe status "Pago". Testado: recusado.
- Saques de afiliado e Cofre Fúria só entram como pendentes; o saque oficial confere o saldo.

### Camada 5 – Lances
- Conta incompleta ou bloqueada não dá lance (bots e admins não afetados).

### Contenção já feita
- 14 contas atacantes bloqueadas, 8 contratos falsos suspensos, 4 saques pendentes recusados, 6 saques "Pago" falsos marcados como fraude. Nada apagado; provas preservadas.
- Endereço do servidor intermediário do Magen retirado do código.

## O que ainda falta (proposta)
1. Você, no painel do Supabase: ligar "Confirm email" e desligar o Google.
2. Você, fora do sistema: proteger/desligar o servidor intermediário do Magen (aceitava pedidos sem senha), trocar chaves e senha, pedir MED ao banco.
3. Eu: bloquear saque e compra de conta incompleta/bloqueada no servidor.
4. Eu: confirmar o bloqueio de lance num leilão ativo.
5. Eu: impedir login das contas bloqueadas (hoje ainda entram, mas não fazem nada).
6. Eu: limitar cadastros por aparelho/internet e ativar verificação anti-robô (precisa da chave do Cloudflare).
7. Eu: auditar a baixa de pedidos de leilão (vencedor altera campos demais).

## Limite honesto
Alguém ainda pode cadastrar com CPF válido de outra pessoa. Por isso as travas de contrato e saque são a proteção principal: mesmo com cadastro falso, não há como ativar plano ou sacar sem pagamento real.
