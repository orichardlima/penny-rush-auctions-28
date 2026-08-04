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
      O baseline deve copiar todos os campos consumidos pelo motor.
      Não omitir líderes de Prata, Ouro, Platina ou Diamante.
      Não usar ON CONFLICT DO NOTHING para ocultar inconsistência.

      ==================================================
      2. REMOVER FALLBACK PARA CONFIGURAÇÃO ATUAL
      ==================================================
      A função expansion_career_config_at deve usar somente versões oficiais.
      Remover o fallback para expansion_career_config.
      Caso nenhuma versão exista para _as_of: retornar erro controlado, bloquear a avaliação, registrar anomalia.

      ==================================================
      3. RESTRINGIR A FUNÇÃO TEMPORAL
      ==================================================
      expansion_career_config_at é função interna.
      REVOKE ALL FROM PUBLIC, anon, authenticated;
      GRANT EXECUTE somente para postgres e service_role.
      Criar RPC separada e sanitizada para o parceiro consultar apenas a configuração vigente.

      ==================================================
      4. RLS ADMINISTRATIVO
      ==================================================
      A tabela de versões deve ser visível somente para administradores, service_role e postgres.
      Parceiro comum não pode consultar versões futuras, motivos, autores, etc.

      ==================================================
      5. STATUS E IMUTABILIDADE
      ==================================================
      Substituir is_active por status fechado: PUBLISHED, SUPERSEDED, CANCELLED.
      Implementar trigger de imutabilidade para versões publicadas.

      ==================================================
      6. VALIDAÇÃO REAL E COMPLETA
      ==================================================
      A função expansion_career_config_validate deve retornar diagnóstico estruturado.
      Validar progressão coerente, tipos, chaves obrigatórias, sort_order único, etc.

      ==================================================
      7. SIMULAÇÃO REAL
      ==================================================
      Criar uma RPC real de preview que utilize o mesmo núcleo do motor oficial com a configuração draft.
      A publicação deve exigir um preview válido e conciliado.

      ==================================================
      8. VIGÊNCIA
      ==================================================
      Validar que effective_from não é retroativo (exceto baseline) e corresponde a segunda-feira 00:00 America/Bahia.

      ==================================================
      9. CONCORRÊNCIA E NUMERAÇÃO
      ==================================================
      Adquirir advisory lock. Adicionar proteção contra duplo clique e publicações simultâneas.

      ==================================================
      10. HASH CANÔNICO
      ==================================================
      Normalizar a configuração antes do hash (SHA-256).

      ==================================================
      11. PUBLICAÇÃO
      ==================================================
      Validar admin, adquirir lock, validar vigência, executar preview real, calcular hash, registrar auditoria.

      ==================================================
      12. CANCELAMENTO
      ==================================================
      Criar wrapper para cancelar somente versões futuras não vigentes, exigindo motivo.

      ==================================================
      13. INTEGRAÇÃO REAL COM O MOTOR
      ==================================================
      Incluir diff das funções expansion_compute_career_state, etc., para que utilizem a configuração temporal.

      ==================================================
      14. TESTES OBRIGATÓRIOS
      ==================================================
      Executar 20 testes com rollback e apresentar saídas reais.

      ==================================================
      15. ENTREGA
      ==================================================
      Apresentar nova migration integral com SQL completo, funções, triggers, RLS e plano de rollback.
    </body>
  );
};

export default Routes;
