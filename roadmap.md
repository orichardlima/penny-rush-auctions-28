# Investigação Magen

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
- [ ] Cadastro: triggers, validações, testes de criação sem CPF/CPF duplicado
- [ ] Contratos/ativação: políticas, triggers, testes de contrato ativo sem pagamento
- [ ] Saldos/créditos: grants de funções privilegiadas, credit_purchase_bids
- [ ] require_complete_profile_generic: confirmar correção SECURITY DEFINER
- [ ] Permissões gerais: RLS, funções SECURITY DEFINER executáveis por usuário comum
- [ ] Testes controlados como usuário comum (rollback) + fluxos legítimos
- [ ] Relatório final com tabela classificada
