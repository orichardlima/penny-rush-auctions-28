# Bônus de Início Rápido duplicados na rede — 21/11
- [x] Cancelar somente os 6 adicionais pendentes (R$ 1.589,94), sem apagar registros e com auditoria da autorização do Richard.
- [x] Corrigir as metas para contar pessoas indicadas distintas; upgrade da mesma pessoa não conta como nova indicação.
- [x] Impedir que adicionais de Início Rápido criem cartões repetidos na rede e validar com 2 testes aprovados.
- [x] Confirmar que os 170 bônus creditados, seus valores e os saldos permaneceram intactos.

# Captura independente de cliques — 15/11
- [x] Registrar entradas públicas em eventos independentes; repetir ID deduplica, recarregar gera novo acesso; automação classificada pelo serviço.
- [x] Eventos separados das indicações e nunca consumidos pelo cadastro; painel sinaliza início da medição e histórico incompleto.
- [x] 8 testes aprovados; captura pública real retorna 200, repetição persiste só uma vez, novo acesso persiste separado; testes de navegação até /auth, hash de comissões inalterado e saldo R$12. Acessos da auditoria classificados como automatizados.
- [ ] Validar cadastro real seguido de leitura no painel autenticado — bloqueado pela ausência de sessão de teste no Supabase externo; nenhuma conta ou compra fictícia criada.

# Indicadores do painel de afiliado — 15/11
- [x] Substituir contadores acumulados por registros reais e compradores únicos; filtrar indicadores e gráfico por período. Saldos continuam atuais, sem filtro; históricos e saques mantêm seus próprios controles.
- [x] Testar caso DNGG (R$12, 2 cadastros, 1 comprador, 50%) e preservar todos os registros financeiros: 5 testes aprovados, leitura final confirma R$12/R$12, 1 comprador, 2 cadastros e 0 cliques registrados; build OK.
- [x] Card de Cliques com os textos originais do print do Richard: título "Cliques" e linha "No seu link"; a data de início da contagem continua nos cálculos e no painel administrativo.
- [x] Cliques nunca abaixo dos cadastros do período: cada cadastro comprova pelo menos um acesso, sem criar eventos retroativos nem alterar finanças; caso DNGG validado com 2 cliques e 7 testes aprovados.
- [x] Revisar painel/funil/gráfico do afiliado, rede de influencers, resumo/detalhe administrativo, captura pública, cadastros e rotinas de pagamento; mínimo aplicado também aos contadores administrativos e à rede, gráfico de compras passou a usar cliques; 8 testes aprovados, sem alterar registros liquidados, finanças ou permissões.
- [ ] Validar painel autenticado — depende de sessão disponível no Supabase externo.

# Acesso como parceiro pelo administrador — 15/11
- [x] Conferir destinos no Auth sem sessão: showdelances.com e testeleilao.site caem em localhost; domínio público Lovable é aceito.
- [x] Corrigir apenas o retorno desse acesso para o domínio público aceito, mantendo autenticação e auditoria.
- [x] Validar testes e endereço público: 2 testes aprovados; página pública abre em /auth sem sessão; função implantada.
- [ ] Abrir painel real pelo acesso administrativo — depende de Richard gerar e usar um link novo; sessão autenticada indisponível neste Supabase externo.

# Cadastro CNPJ somente empresarial — 13/11
- [x] Remover CPF, responsável e nascimento do fluxo PJ no cadastro inicial e na conclusão, mantendo PF inalterado.
- [x] Ajustar validações server-side e testar CNPJ sem dados pessoais e CPF com dados obrigatórios, sem persistir testes.

# Auditoria técnica PIX Magen — 15/11 (somente leitura, sem correções sem autorização)
- [x] Mapear fluxo PIX IN (VPS, Edge Functions, webhook, confirmação, liberação de benefícios).
- [x] Levantar evidências das falhas: cron 188 com 451 falhas/24h ("job startup timeout", 107 jobs ativos), ativação de R$ 1.499 pendente 26 min, 6 cobranças não pagas de 14/11, 59 em review; zero completed sem benefício e zero reuso de tx.
- [x] Avaliar recuperação automática e segurança financeira (autenticidade, valor/titular, anti-reuso, idempotência).
- [x] Entregar relatório com arquitetura, falhas, hipóteses, proposta de correção, reconciliação e plano de testes (`/mnt/documents/Auditoria_PIX_Magen_2026-11-15.md` + diagrama).
- [ ] Aguardar autorização para: agendador externo da recuperação, alerta de fila parada e conciliação das 59 cobranças em review com extratos.

# Recuperação automática de PIX — 12/11
- [ ] Validar uma execução automática da recuperação MagenPay — bloqueado pelos timeouts de inicialização: 85 tarefas/minuto para 32 slots; o usuário optou por não reorganizar as tarefas dos leilões. Agendamento isolado recriado com novas tentativas a cada minuto enquanto houver fila.
- [x] Testar dupla confirmação de upgrade pago e comparar integralmente o contrato, histórico e créditos — `already_processed=true`, hash contratual inalterado, um upgrade e uma confirmação de R$ 1.500; 6 testes MagenPay aprovados.

# Investigação Magen

# Correção MagenPay autorizada em 29/10
- [x] Corrigir confirmação dos quatro fluxos e referência de upgrade, sem alterar VeoPag.
- [x] Persistir vínculos PIX, validar titular/valor e garantir processamento atômico sem duplicidade.
- [x] Recuperar novos pagamentos com a tela fechada por fila limitada; testes de validação e duplicidade passaram.
- [ ] Validar pagamento real nos quatro fluxos e recuperação com a tela fechada — depende de sessão autenticada e pagamentos de teste autorizados; sem sessão disponível neste Supabase externo.
- [ ] Recuperar cobranças anteriores sem vínculo PIX confiável — depende de conciliação com códigos e dados retornados pela VPS; não confirmar por suposição.

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
