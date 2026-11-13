# Cadastro com CNPJ para Parceiros de Expansão

## O que muda para o usuário
- Na tela de cadastro aparece a escolha **Pessoa Física (CPF)** ou **Pessoa Jurídica (CNPJ) – para Parceiros de Expansão**.
- Se escolher CNPJ: campo CNPJ (com máscara e validação dos dígitos) + **Razão Social**. Nome, e-mail, telefone, endereço e aceite continuam obrigatórios. Não se pede o CPF do responsável.
- O CNPJ precisa ser válido e não pode estar cadastrado em outra conta, igual ao CPF hoje.
- Contas com CNPJ ficam marcadas como "Pessoa Jurídica" no admin (detalhe do parceiro e listas).
- Só vale para cadastros novos; contas existentes com CPF não mudam.

## Regra "só parceiros de expansão"
- A conta CNPJ pode entrar no site e ativar/fazer upgrade de plano de parceiro normalmente.
- Funções de jogador comum que exigem CPF continuam iguais para contas CPF. Para conta CNPJ, compra de lances e pagamentos PIX usam o CNPJ como documento do pagador.
- O afiliado comum e o restante do site não mudam.

## Saques
- Conta CNPJ pode sacar para chave PIX do CNPJ **ou** para o CPF do responsável. Se escolher CPF, ele informa o CPF do responsável no formulário de dados de pagamento (validado).
- Taxas, bloqueios e regras de saque não mudam.

## Segurança preservada
- A verificação no servidor continua: exige cadastro por e-mail, documento válido e único (CPF ou CNPJ) e dados completos. Nada de cadastro externo sem documento.
- Contas banidas continuam bloqueadas; VeoPag/MagenPay não têm o fluxo alterado, só recebem o CNPJ como documento quando for o caso.

## Detalhes técnicos
- Migração: novas colunas em `profiles`: `document_type` ('CPF' padrão | 'CNPJ'), `cnpj` (índice único), `company_name`. Função `_is_valid_cnpj`. Atualizar `enforce_complete_signup` e `_profile_data_complete` para aceitar CPF **ou** CNPJ conforme `document_type`. `check-availability` passa a checar CNPJ.
- Frontend: `validators.ts` (validateCNPJ/formatCNPJ), `Auth.tsx` (seletor + campos), `CompleteProfile`/`UserProfileEditor` (mostrar CNPJ só leitura), `useProfileCompleteGuard`, admin mostra tipo.
- Edge functions de pagamento: usar `cpf ?? cnpj` como documento do pagador (sem alterar demais lógica).
- Saques: `PartnerPaymentDetailsForm` aceita chave CNPJ ou CPF do responsável para contas CNPJ.
- Testes: validação de CNPJ (válido/inválido/duplicado) e cadastro com CNPJ aceito pelo trigger; cadastro sem documento recusado.
