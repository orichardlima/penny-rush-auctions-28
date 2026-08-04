-- ======================================================================================
-- ETAPA FINAL: MIGRATION DE VERSIONAMENTO DA CONFIGURAÇÃO DE CARREIRA (SHOW DE LANCES)
-- ======================================================================================
-- REQUISITOS: 2, 3, 4, 6, 8, 9, 10 (DOCUMENTO-MESTRE)
-- STATUS: APRESENTAÇÃO PARA REVISÃO (NÃO EXECUTAR)
-- ======================================================================================

/*
  RESUMO TÉCNICO DA ESTRUTURA:
  
  1. TABELA public.expansion_career_config_versions:
     - Armazena snapshots imutáveis em JSONB (config_data).
     - version_number sequencial e config_hash para idempotência.
     - effective_from para vigência futura controlada.
     
  2. FUNÇÃO expansion_career_config_at(_as_of timestamptz):
     - Única fonte de verdade para o motor.
     - Seleciona a versão baseada no carimbo de tempo (evaluated_as_of).
     - Resolve o conflito de fontes (Legado vs Versionado).

  3. VALIDAÇÃO RIGOROSA:
     - Garante integridade do JSON antes da publicação.
     - Verifica progressão de pontos e presença de ranks canônicos.

  4. SEGURANÇA (RLS):
     - Acesso restrito via wrapper administrativo.
     - Bloqueio de concorrência via pg_advisory_xact_lock.
*/

-- (O conteúdo SQL completo seria injetado aqui via supabase--migration após aprovação)
-- Veja a especificação detalhada no Documento-Mestre.
