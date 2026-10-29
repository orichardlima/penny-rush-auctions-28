# Investigação Magen

# Correção MagenPay autorizada em 29/10
- [ ] Corrigir confirmação dos quatro fluxos e referência de upgrade, sem alterar VeoPag.
- [ ] Persistir vínculos PIX, validar titular/valor e garantir processamento atômico sem duplicidade.
- [ ] Recuperar pagamentos com a tela fechada por fila limitada e testar proteções.

- [x] Auditar rotas financeiras e controles de autorização sem chamadas bancárias.
- [x] Conferir permissões e funções financeiras em produção por consultas somente de leitura.
- [x] Distinguir evidências históricas, vulnerabilidades comprovadas e hipóteses.
- [x] Entregar relatório técnico e plano de correção sem alterar o sistema.
- [ ] Validar segurança e acessos da VPS — depende de código e registros da VPS.
- [ ] Correlacionar os PIX com registros do Magen — depende de informações técnicas do banco.

# Correção definitiva da fraude de contratos
- [x] Bloquear pedidos de pagamento e contratos gravados direto por usuário comum
- [x] RPC segura para troca de chave PIX + auditoria
- [x] Registro central de confirmações de pagamento (anti-reuso)
- [x] Revisar credit_purchase_bids e require_complete_profile_generic
- [x] Webhooks só confirmam com verificação no provedor
- [x] Varredura histórica classificada (só relatório)
- [x] Testes com conta comum e relatório final
- [ ] Conciliar 50 contratos sem código do provedor com extratos — depende dos extratos

# Auditoria final de segurança (28/10) — somente leitura + testes revertidos
- [x] Cadastro: triggers, validações, testes de criação sem CPF/CPF duplicado
- [x] Contratos/ativação: políticas, triggers, testes de contrato ativo sem pagamento
- [x] Saldos/créditos: grants de funções privilegiadas, credit_purchase_bids
- [x] require_complete_profile_generic: confirmar correção SECURITY DEFINER
- [x] Permissões gerais: RLS, funções SECURITY DEFINER executáveis por usuário comum
- [x] Testes controlados como usuário comum (rollback) + fluxos legítimos
- [x] Relatório final com tabela classificada
- [x] AUTORIZADO em 28/10: conferir dependências e conter as 19 funções dos itens 3.1–3.11 (ampliado para 22 assinaturas)
- [x] Auditar histórico disponível de ciclos, pontos, lances, expansão, Cofre e afiliados sem reversões; registrar limites da evidência
- [x] Testar permissões, ajuste admin e resgate/cancelamento com rollback; provar trigger em INSERT autorizado pela RLS
- [x] Verificar confirmação de e-mail e Turnstile sem alterar acessos: auto-confirmação ligada, Google desligado, widget desativado
- [x] Entregar relatório de contenção, dependências, testes, limites e reversão técnica
- [ ] Verificar jornadas autenticadas completas, compra PIX e automações semanais em ambiente seguro — depende de sessão de teste e ambiente isolado para integração financeira
- [ ] Ativar confirmação de e-mail e Turnstile — depende de configuração administrativa e chaves Cloudflare, sem prejudicar clientes existentes
- [ ] Revisar defaults do owner reservado supabase_admin — depende de caminho administrativo autorizado para configuração gerenciada
- [ ] Completar auditoria histórica e conciliação de métricas — depende de logs históricos externos e extratos; diferenças não provam fraude
