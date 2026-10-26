# Ataque: contratos e saques falsos criados direto pela conta do usuário

## Urgente – PIX reais no Banco Magen (25/10)
- Saíram de verdade: R$ 1,00 para AMBEV S A às 16:44, e R$ 1,00 + R$ 3.067,00 para LEONARDO BROLESI às 16:55.
- **Nenhum desses PIX existe no nosso sistema.** Não há saque com código de transação nos últimos 3 dias, nem registro no histórico do admin. Os saques "Pago" falsos do print não geraram PIX.
- O padrão (R$ 1 de teste e depois o valor alto) indica que alguém usou **direto a credencial ou o acesso do Banco Magen**, sem passar pelo site. Os registros de chamadas do servidor desse horário não estão disponíveis, então isso não foi confirmado.
- O que você deve fazer agora, fora do sistema:
  1. Trocar a senha do painel Magen e **gerar novas chaves de API** (e do servidor intermediário/VPS), bloqueando o PIX de saída até terminar.
  2. Pedir ao Magen a **devolução pelo MED** (Mecanismo Especial de Devolução) dos PIX para LEONARDO BROLESI, e solicitar o IP/origem dessas transações.
  3. Atualizar os segredos novos no Supabase (só você pode fazer isso).
- A conta atacante também tentou acessar a lista de usuários do sistema com permissão de administrador (recusado, erro 403), a partir do IP 104.28.197.251.

## O que foi encontrado
- Os saques do print são da conta **pentest.xbot.1792890313@mailnull.com**, criada em 25/10 às 01:05. Ela tem um contrato **Legend R$ 9.999** que nunca foi pago.
- Os saques já foram gravados como **"Pago"**, com data de pagamento inventada e sem nenhum admin responsável. Também não têm código de transação PIX. Ou seja, **nenhum PIX saiu pelo gateway**: o "Pago" é falso.
- Existem ainda **3 contas "diamond.test...@mailnull.com"** com contratos Diamond de R$ 25.000 falsos e saques **pendentes de R$ 5.000 cada**, todos para a mesma chave PIX **518.389.678-00**.
- Vários contratos falsos já têm **repasse semanal** gerado, e alguns têm **bônus de indicação** para patrocinadores.

## Como entraram
O banco permite que qualquer usuário logado:
1. crie um contrato próprio já como ATIVO, com qualquer plano e valor;
2. altere o próprio contrato;
3. grave um saque direto, escolhendo o status (inclusive "Pago") e o valor, sem passar pela verificação de saldo.

## Plano

### Fase 1 – Contenção imediata
- **Não pague** nenhum saque da chave 518.389.678-00. Vou deixar todos os saques dessas contas como **Recusado – fraude**.
- Suspender os contratos falsos e bloquear as contas envolvidas.
- Tirar do usuário a permissão de criar ou alterar contrato e de gravar saque direto. Saque passa a ser feito só pelo caminho oficial (`partner_request_withdrawal`), que confere o saldo. Contrato passa a ser criado só pelo pagamento confirmado ou por ação do admin.

### Fase 2 – Varredura e limpeza
- Listar todos os contratos sem pagamento confirmado (sem intent pago, sem ativação por saldo ou crédito e sem ação do admin) e todos os saques "Pago" sem admin e sem transação.
- Cancelar os repasses, bônus de indicação e pontos de rede gerados por esses contratos. Antes, mostro a lista para você aprovar, porque alguns contratos recentes com patrocinador podem ser verdadeiros.
- Conferir as outras tabelas que o usuário consegue gravar sozinho (repasses, carteiras, saques de afiliado, cofre) e fechar as que tiverem a mesma falha.

### Fase 3 – Conferência
- Testar com um usuário comum que criar contrato ou saque direto agora é recusado, e que o saque normal pelo painel continua funcionando.
- Relatório final com valores, contas e o que foi revertido.

## Detalhes técnicos
- Remover as políticas INSERT/UPDATE de usuário em `partner_contracts` e INSERT em `partner_withdrawals`. Criação via RPCs SECURITY DEFINER / edge functions (service_role).
- Trigger em `partner_withdrawals` que impede status inicial diferente de PENDING/APPROVED fora do service_role.
- Auditar as políticas de `partner_payouts`, `partner_referral_bonuses`, `partner_network_wallets`, `affiliate_withdrawals` e `fury_vault_withdrawals`.
