
Pergunta de pesquisa, não implementação. Não preciso de plano — só responder com base no código.

Verificações já feitas em mensagens anteriores:
- `mem://tech-decision/affiliate-activation-flow`: "A criação automática de registros de afiliados durante o cadastro do usuário foi removida"
- `AffiliateOnboarding.tsx`: tem botão "Ativar Minha Conta de Afiliado Grátis" que chama `createAffiliateAccount` manualmente
- `affiliateHelpers.ts`: função `createAffiliateAccount` é chamada apenas via clique do usuário
- RLS da tabela `affiliates`: policy "Users can insert own affiliate account" exige ação do próprio usuário

Resposta clara: NÃO. Cadastro normal não cria afiliado. Precisa ativar manualmente em `/afiliado`.
