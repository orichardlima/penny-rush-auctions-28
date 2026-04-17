
Objetivo: restringir o programa de afiliados para fazer sentido com a nova regra de negócio, sem mexer em fluxos fora desse escopo.

1. Regras novas que vou implementar
- Só poderá entrar no sistema de afiliados por 2 caminhos:
  - Parceiro de expansão ativo: vira Manager de afiliados.
  - Convidado por um Manager: vira Influencer.
- Parceiros existentes: serão promovidos automaticamente a Manager.
- Afiliados antigos fora dessa regra: continuam ativos (regra de transição).
- Convite do Manager: manter os dois fluxos
  - link `?ref=CODIGO_DO_MANAGER`
  - convite manual por código/e-mail
- Comissão do Manager: manter flexível, mas já partir da regra desejada de 50% na primeira compra e 10% na recompra.
- Comissão do Influencer: totalmente configurável no painel do ADM, sem valor travado no código.

2. O que precisa mudar no banco
- Criar/ajustar a lógica de elegibilidade para impedir que qualquer usuário autenticado crie conta de afiliado.
- Criar função de validação para permitir criação de afiliado apenas quando:
  - o usuário tiver contrato ativo em `partner_contracts` -> cria como `manager`
  - ou houver vínculo/convite válido com manager -> cria como `influencer`
- Fazer migração de dados para:
  - promover parceiros ativos atuais a `manager`
  - preservar afiliados antigos já existentes
- Ajustar a lógica de criação para gravar corretamente:
  - `role`
  - `recruited_by_affiliate_id`
  - `source_manager_affiliate_id`
  - taxas iniciais conforme tipo
- Evoluir configurações do sistema para separar percentuais por tipo:
  - manager primeira compra
  - manager recompra
  - influencer primeira compra
  - influencer recompra
  - override padrão do manager sobre influencers
- Revisar triggers/RPCs de comissão para usar essas configurações por tipo em vez de depender de uma taxa global única.

3. O que precisa mudar no frontend
- Onboarding de afiliado:
  - deixar de oferecer ativação livre para qualquer usuário
  - mostrar mensagem contextual:
    - se é parceiro ativo: pode ativar como Manager
    - se entrou por convite de manager: pode ativar como Influencer
    - se não atende regra: informar que o programa é exclusivo para parceiros de expansão ou convidados de gerente
- Dashboard do usuário comum:
  - ajustar CTA que hoje convida qualquer pessoa a “ser afiliado”
- Dashboard do afiliado:
  - manter a experiência atual, mas refletir o papel correto (`manager` ou `influencer`)
- Painel do ADM:
  - trocar a configuração global única por configuração flexível por tipo
  - manter o gerenciamento atual, mas com regras mais claras para papel/elegibilidade

4. Impacto no fluxo
- Usuário comum sem parceria e sem convite: não entra no programa.
- Parceiro ativo: pode/será habilitado como Manager.
- Usuário convidado por manager: pode virar Influencer mesmo sem ser parceiro.
- Afiliados antigos seguem funcionando para não quebrar o histórico e as comissões já existentes.

5. Cuidados para não quebrar o que já existe
- Não vou alterar fluxos de leilão, pagamentos, parceiros ou saques fora do necessário.
- Vou preservar a hierarquia manager/influencer já criada.
- Vou manter compatibilidade com links `?ref=` e com o convite manual atual.
- Vou revisar textos da UI que ainda falam “qualquer usuário pode virar afiliado” ou mostram 10% fixo.

6. Detalhes técnicos
- Hoje o sistema ainda permite ativação ampla via onboarding e RLS da tabela `affiliates`; isso será fechado.
- Hoje existe configuração global de comissão e recompra; ela será desmembrada por papel.
- A geração de override já existe e será mantida, apenas alinhada às novas regras.
- A implementação deve combinar:
  - migration SQL para regra, backfill e validações
  - ajuste no helper `createAffiliateAccount`
  - ajuste no onboarding/dashboard
  - ajuste no painel admin de configurações

7. Entrega prática
Vou executar em 3 blocos:
- Bloco 1: banco + regras de elegibilidade + promoção automática dos parceiros existentes
- Bloco 2: onboarding/dashboard para refletir quem pode ou não ativar
- Bloco 3: painel do ADM com comissões flexíveis por tipo + ajuste da lógica de comissionamento
