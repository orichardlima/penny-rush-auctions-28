
Objetivo: corrigir os bônus de indicação que faltaram nas ativações internas do ADM e blindar o sistema para que isso não volte a acontecer em nenhum fluxo.

1) Diagnóstico confirmado (causa raiz)
- O fluxo de ativação interna (`src/components/AdminUserManagement.tsx`) permite “Código de Indicação (opcional)” e, quando inválido/ausente, continua com `sponsor:none`.
- O trigger de bônus em cascata (`create_cascade_referral_bonuses`) só roda no `AFTER INSERT` de `partner_contracts` e só cria bônus se `referred_by_user_id` já vier preenchido.
- Quando o `referred_by_user_id` é corrigido depois (ou quando só existe vínculo binário), os bônus não são criados automaticamente.

Evidência dos dados atuais:
- Richard tem 4 patrocinados na rede binária e os 4 estão com `referred_by_user_id = NULL` (sem bônus de indicação).
- Há 9 contratos ACTIVE com sinal de referência (sponsor/referred) mas sem bônus nível 1; 7 deles com `referred_by_user_id` nulo e 2 com `referred_by_user_id` preenchido posteriormente (sem trigger de update).

2) Correção imediata (dados já afetados)
- Executar backfill idempotente em 2 etapas:
  a) Preencher `referred_by_user_id` onde estiver nulo, usando o sponsor binário direto (`partner_binary_positions.sponsor_contract_id -> partner_contracts.user_id`), com filtros de segurança:
     - contrato ACTIVE
     - sem bônus nível 1 existente
     - sem autoindicação (`referred_by_user_id != user_id`)
  b) Gerar bônus faltantes (níveis 1, 2 e 3) para contratos sem registros em `partner_referral_bonuses`, respeitando regras atuais de percentual.
- Começar pelos casos do Richard (4 contratos) e aplicar no restante dos casos elegíveis na mesma rotina (para evitar novos “buracos” antigos).

3) Prevenção definitiva (backend/DB)
- Criar uma função única e idempotente para “garantir bônus de indicação” por contrato (ex.: `ensure_partner_referral_bonuses(contract_id)`), com `ON CONFLICT DO NOTHING` por `(referred_contract_id, referral_level)`.
- Atualizar o trigger de criação para chamar essa função.
- Adicionar novo trigger `AFTER UPDATE OF referred_by_user_id` (quando muda de `NULL` para valor) para também chamar essa função.
- Resultado: mesmo que o vínculo de indicação seja corrigido depois, os bônus serão criados automaticamente.

4) Prevenção no fluxo ADM (UI mínima e focada no problema)
- Em `AdminUserManagement.tsx`:
  - remover fallback silencioso “prosseguir sem sponsor” quando código inválido;
  - exigir vínculo explícito: sponsor válido ou opção “Sem sponsor” com confirmação explícita;
  - registrar no `admin_audit_log` qual decisão foi tomada (sponsor escolhido ou sem sponsor intencional).
- Isso evita erro operacional humano no painel sem alterar outras áreas não relacionadas.

5) Validação e garantia pós-correção
- Queries de verificação pós-implementação:
  - nenhum ACTIVE com `referred_by_user_id` preenchido e sem bônus nível 1;
  - nenhum caso elegível por sponsor binário sem tratamento;
  - Richard com bônus esperados nos contratos corrigidos.
- Teste E2E obrigatório:
  - ativação interna com sponsor válido -> bônus criado automaticamente;
  - correção posterior de `referred_by_user_id` -> bônus criado pelo trigger de update;
  - cenário “sem sponsor intencional” -> sem bônus (com auditoria).

Se você mantiver aprovação, no próximo passo eu executo exatamente esse plano com impacto limitado ao problema de indicação (sem mexer em fluxos não relacionados).

Seção técnica (implementação objetiva)
- Arquivos alvo:
  - `supabase/migrations/<novo_arquivo>.sql` (função idempotente + triggers + backfill)
  - `src/components/AdminUserManagement.tsx` (validação de sponsor no modal de ativação)
- Regras SQL chave:
  - evitar duplicidade: `ON CONFLICT (referred_contract_id, referral_level) DO NOTHING`
  - garantir integridade: bloquear autoindicação
  - backfill com filtro por ausência de bônus nível 1
- Estratégia de segurança:
  - sem alteração em tabelas de auth/storage
  - sem alteração de UI/fluxos fora do contexto de ativação de parceiro e bônus de indicação
