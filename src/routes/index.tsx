import Index from "../pages/Index";

const Routes = () => {
  return (
    <body>
      REPROVAÇÃO TÉCNICA DA MIGRATION

      expansion_career_config_v2_spec.sql

      Não aplicar a migration apresentada.

      A revisão integral identificou bloqueios críticos. O SQL entregue não
      implementa integralmente as garantias descritas no resumo.

      Refazer a migration observando os pontos abaixo.

      ==================================================
      1. BASELINE COMPLETO E TEMPORALMENTE VÁLIDO
      ==================================================
      Não utilizar arbitrariamente: 2026-07-27 13:00:00+00.
      Consultar o menor corte histórico relevante em:
      - expansion_rank_evaluations.evaluated_as_of;
      - expansion_rank_runs.evaluated_as_of;
      - runs e dry-runs que devam permanecer explicáveis.
      A Versão 1 deve ter effective_from menor ou igual ao menor corte suportado.
      O baseline deve copiar todos os campos consumidos pelo motor, incluindo: rank_key, rank_label, sort_order, min_organizational_points, min_qualified_teams, max_team_concentration_pct, min_qualified_team_points, min_active_partners_per_team, required_leaders.
      Não omitir líderes de Prata, Ouro, Platina ou Diamante.
      Não usar ON CONFLICT DO NOTHING para ocultar inconsistência.

      ==================================================
      2. REMOVER FALLBACK PARA CONFIGURAÇÃO ATUAL
      ==================================================
      A função expansion_career_config_at deve usar somente versões oficiais.
      Remover o fallback para expansion_career_config.
      Caso nenhuma versão exista para _as_of: retornar erro controlado, bloquear a avaliação, registrar anomalia.
      Nunca usar silenciosamente a configuração atual para interpretar o passado.

      ==================================================
      3. RESTRINGIR A FUNÇÃO TEMPORAL
      ==================================================
      expansion_career_config_at é função interna.
      REVOKE ALL FROM PUBLIC, anon, authenticated;
      GRANT EXECUTE somente para postgres e service_role.
      Criar RPC separada e sanitizada para o parceiro consultar apenas a configuração vigente, sem aceitar _as_of futuro.

      ==================================================
      4. RLS ADMINISTRATIVO
      ==================================================
      A tabela de versões deve ser visível somente para administradores, service_role e postgres.
      Parceiro comum não pode consultar versões futuras, motivos, autores, dry-run, hashes ou auditoria.

      ==================================================
      5. STATUS E IMUTABILIDADE
      ==================================================
      Substituir is_active por status fechado: PUBLISHED, SUPERSEDED, CANCELLED.
      Adicionar published_at, published_by, cancelled_at, superseded_at.
      Implementar trigger de imutabilidade para versões publicadas e vigentes.
      Correções geram nova versão.

      ==================================================
      6. VALIDAÇÃO REAL E COMPLETA
      ==================================================
      A função expansion_career_config_validate deve retornar diagnóstico estruturado.
      Validar progressão coerente, tipos, chaves obrigatórias, sort_order único, presença dos cinco ranks, concentração (0-100), etc.
      Reconstruir configuração canônica ordenada por sort_order.

      ==================================================
      7. SIMULAÇÃO REAL
      ==================================================
      Criar uma RPC real de preview que utilize o mesmo núcleo do motor oficial com a configuração draft.
      Deve retornar encontrados, elegíveis, excluídos, falhas, promoções, bloqueios por concentração/equipes/líderes.
      A publicação deve exigir um preview válido e conciliado.

      ==================================================
      8. VIGÊNCIA
      ==================================================
      Validar que effective_from não é retroativo (exceto baseline) e corresponde exatamente a segunda-feira 00:00 America/Bahia.
      A exceção do baseline deve existir apenas dentro da migration.

      ==================================================
      9. CONCORRÊNCIA E NUMERAÇÃO
      ==================================================
      Adquirir advisory lock. Adicionar proteção contra duplo clique, publicações simultâneas e mesma requisição idempotente.

      ==================================================
      10. HASH CANÔNICO
      ==================================================
      Normalizar a configuração antes do hash (SHA-256).

      ==================================================
      11. PUBLICAÇÃO
      ==================================================
      Validar admin, adquirir lock, validar vigência, executar preview real, bloquear CRITICAL/HIGH, calcular hash, registrar auditoria.
      Motivo obrigatório e não vazio.

      ==================================================
      12. CANCELAMENTO
      ==================================================
      Criar wrapper para cancelar somente versões publicadas futuras não vigentes, exigindo motivo.
      Registrar quem cancelou e quando.

      ==================================================
      13. INTEGRAÇÃO REAL COM O MOTOR
      ==================================================
      Incluir diff das funções expansion_compute_career_state, expansion_run_career_evaluation, etc., para que utilizem a configuração temporal.
      Preservar config_snapshot em runs e avaliações.

      ==================================================
      14. TESTES OBRIGATÓRIOS
      ==================================================
      Executar 20 testes com rollback e apresentar saídas reais:
      1. baseline contém todos os campos;
      2. corte histórico encontra Versão 1;
      3. ausência de versão gera erro;
      4. parceiro não lê versões;
      5. parceiro não chama função temporal;
      6. publicação futura não altera vigente;
      7. vigência no meio da semana rejeitada;
      8. vigência retroativa rejeitada;
      9. preview não grava;
      10. Richard permanece NONE;
      11. duas publicações concorrentes bloqueadas;
      ... (ver lista completa no documento).

      ==================================================
      15. ENTREGA
      ==================================================
      Apresentar nova migration integral com SQL completo, funções, triggers, RLS e plano de rollback.
      Não utilizar placeholders ou comentários de "implementar depois".
    </body>
  );
};

export default Routes;
