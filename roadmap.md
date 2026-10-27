# Investigação Magen

- [x] Auditar rotas financeiras e controles de autorização sem chamadas bancárias.
- [x] Conferir permissões e funções financeiras em produção por consultas somente de leitura.
- [x] Distinguir evidências históricas, vulnerabilidades comprovadas e hipóteses.
- [x] Entregar relatório técnico e plano de correção sem alterar o sistema.
- [ ] Validar segurança e acessos da VPS — depende de código e registros da VPS.
- [ ] Correlacionar os PIX com registros do Magen — depende de informações técnicas do banco.

# Correção definitiva da fraude de contratos
- [ ] Bloquear pedidos de pagamento e contratos gravados direto por usuário comum
- [ ] RPC segura para troca de chave PIX + auditoria
- [ ] Registro central de confirmações de pagamento (anti-reuso)
- [ ] Revisar credit_purchase_bids e require_complete_profile_generic
- [ ] Webhooks só confirmam com verificação no provedor
- [ ] Varredura histórica classificada (só relatório)
- [ ] Testes com conta comum e relatório final
