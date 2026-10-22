# Auditoria técnica — Central de Anúncios e proposta de Central de Divulgação Verificada

Etapa somente de análise. Nada foi alterado. Aprovar este plano autoriza apenas a Fase 0 (abaixo); fases financeiras exigem nova aprovação.

## 1. Diagnóstico confirmado (sistema atual)

- **Tabelas:** `ad_center_materials` (material do dia; hoje 1 ativo) e `ad_center_completions` (id, partner_contract_id, material_id, completion_date, social_network, confirmed_at). Única restrição: `UNIQUE (partner_contract_id, completion_date)`. Sem triggers.
- **Confirmação:** o parceiro escolhe a rede e clica "Confirmar Divulgação"; o navegador grava direto na tabela (`useAdCenter.ts`), com a data calculada **pelo relógio do celular/computador**.
- **Permissão de gravação (RLS):** qualquer parceiro com contrato ACTIVE pode inserir para o próprio contrato **com qualquer data**. Não há bloqueio no servidor contra data futura ou retroativa — só a tela impede. Duplicidade no mesmo dia é barrada pela restrição única.
- **Indício confirmado:** 316 registros têm `completion_date` diferente da data real (Bahia) do `confirmed_at`, sinal de data vinda do aparelho (fuso/relógio) ou de gravação fora do dia.
- **Semana:** segunda 00:00 a domingo 23:59; frontend usa hora local do aparelho; o fechamento usa as datas gravadas.
- **100% / 40%:** Edge Function `partner-weekly-payouts` conta registros da semana: 7/7 = 100%, qualquer falta = 40% (constantes no código). Nenhum cron/trigger adicional interfere.
- **Instagram x WhatsApp:** nenhuma diferença de regra; a rede é só um rótulo (whatsapp 913, instagram 888, facebook 33, tiktok 25, outro 11, system_grace 61 = abono de 21/10).
- **Admin:** aba de acompanhamento semanal (`AdminWeeklyAdsTab`) e gerenciador de materiais. Não há trilha de evidência nem contestação.

## 2. Central de Performance — o que existe

- Rota `/r/:code` ativa, Edge Function `track-referral`, tabelas `tracking_events`, `attribution_events`, `referral_links` (94 links), `performance_settings` com pontuação e antifraude (dedupe 6h, teto de cliques, autoindicação bloqueada, fuso Bahia).
- Funções: `attribute_conversion`, `handle_new_user_performance_attribution`, `reverse_performance_points`, `get_partner_performance_summary/history/dashboard`; webhooks de compra/plano chamam a atribuição.
- **Estado real:** `performance_center_enabled = false`. Só 11 eventos de rastreio e 1 conversão, todos de 08/07/2026 (teste). Em produção, está praticamente parado.
- **Integração entre as centrais:** apenas visual (`PartnerPerformanceSection` dentro da Central de Anúncios). Nenhum vínculo de dados com o repasse.

## 3. Limites reais das integrações

| Estratégia | Comprova publicação? | Observação |
|---|---|---|
| Instagram Graph API (OAuth Meta) | Sim, para posts/Reels; Stories só por 24h | Só contas Profissionais (Criador/Empresa); exige app Meta revisado; contas pessoais ficam de fora |
| Link público do post do Instagram | Parcial | Verificável manualmente; leitura automática instável |
| WhatsApp Status / grupos | **Não** | Não existe API oficial para ler Status ou conversas de terceiros |
| Link exclusivo `/r/{code}` por campanha/canal | Não (indica tráfego) | Prova que alguém clicou, não que houve postagem |
| Print de tela | Indício | Falsificável; melhora com código do dia visível na arte, hash anti-reuso e revisão |

## 4. Alternativas comparadas

- **A. Print + código do dia na arte + link exclusivo + revisão por amostragem** — confiabilidade média/alta, complexidade baixa, custo zero. Recomendada como base.
- **B. A + OAuth Instagram para contas profissionais** — alta para quem conectar, complexidade alta (revisão Meta), custo baixo em dinheiro, alto em prazo.
- **C. Só rastreamento por cliques** — baixa como prova de postagem; boa como métrica comercial.

## 5. Arquitetura recomendada (Central de Divulgação Verificada)

- `promo_campaigns` (campanha diária, material oficial, código do dia, janela de validade Bahia).
- `promo_submissions` (parceiro, campanha, canal, link do post, print, hash do arquivo, status: PENDENTE, AUTO_APROVADO, APROVADO, REJEITADO, CONTESTADO).
- `promo_submission_reviews` e `promo_disputes` (trilha de auditoria e contestação).
- Links `/r/{code}?c={campanha}&ch={canal}` reaproveitando `track-referral` e `tracking_events` (sem nova infraestrutura).
- Envio via função no servidor (data = hora do servidor Bahia, idempotente por parceiro+dia), bloqueio de reuso de print por hash.
- Admin: fila de revisão, amostragem, relatórios, motivos de rejeição; notificações ao parceiro.
- Obrigação diária (submissões aprovadas) separada das métricas comerciais (performance).
- Ligação com o repasse **só por flag desligada**, gravando no mesmo `ad_center_completions` quando aprovado, para não mexer no cálculo atual.

## 6. Fases

- **Fase 0 (segurança, sem impacto financeiro):** bloquear no servidor data futura/retroativa nas confirmações atuais (trigger que força a data Bahia do momento). Requer sua aprovação expressa por tocar a regra de gravação.
- **Fase 1:** tabelas novas, envio de print/link + código do dia, fila admin. Modo relatório, sem afetar repasse.
- **Fase 2:** links exclusivos por campanha/canal reaproveitando a Performance; religar `performance_tracking`.
- **Fase 3:** Instagram OAuth opcional para contas profissionais.
- **Fase 4:** ligar a verificação ao 100%/40% via flag, após período de teste e sua aprovação.

## 7. Riscos

- Mudar o critério sem aviso afeta repasses; manter flag desligada e período de transição.
- Revisão manual exige equipe; usar autoaprovação com amostragem.
- Armazenar prints aumenta uso de storage e exige bucket privado.
- Nenhuma função de payout, carteira, saque, comissão ou Expansão será alterada sem nova aprovação.

## 8. Decisões que preciso de você

1. Aceita print + link como prova mínima, sabendo que WhatsApp Status não é verificável por API?
2. Quem revisa (equipe admin, amostragem, ou só automático)?
3. Prazo de contestação e efeito de rejeição (dia perdido ou reenvio)?
4. Instagram OAuth vale o custo de revisão Meta agora ou fica para depois?
5. Aprova a Fase 0 (trava de data no servidor) mesmo antes do resto?
