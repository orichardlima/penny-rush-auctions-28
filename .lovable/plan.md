# Plano de Correção: Falha de Carregamento na Aba "Expansão por Equipes"

O usuário confirmou que a página tenta carregar e falha com o ícone amarelo ("Página não carregou"). Isso indica um erro de runtime durante a renderização do componente ou na execução dos hooks de dados.

## Diagnóstico Confirmado
- **Causa Raiz**: Presença de arquivos JavaScript compilados (`.js`) em conflito com arquivos TypeScript (`.ts`/`.tsx`). Foi detectado `src/hooks/useExpansionCareer.js`.
- **Impacto**: O Vite/Lovable pode tentar importar o arquivo `.js` desatualizado em vez do `.ts`, causando erros de execução ou falhas de tipagem em runtime que quebram o componente `ExpansionProgramSection`.

## Ações Propostas

### 1. Limpeza Radical de Arquivos JS (Execução)
Remover todos os arquivos `.js` que possuem equivalentes `.ts` ou `.tsx` nas pastas de hooks e componentes do programa de expansão.
- `src/hooks/*.js`
- `src/components/Partner/Expansion/*.js`

### 2. Reforço na Resiliência do Componente
Adicionar um bloco `try-catch` no carregamento dos dados dentro do `ExpansionProgramSection.tsx` e garantir que erros nos hooks não causem um crash fatal na renderização.

### 3. Verificação de Integridade das RPCs
Validar se as RPCs chamadas pelos hooks (`expansion_get_partner_overview`, `expansion_partner_get_my_career`) estão retornando dados no formato esperado, evitando falhas de desestruturação (destructuring) de objetos nulos/indefinidos.

## Teste de Verificação
- Forçar a limpeza dos arquivos conflitantes.
- Abrir o Dashboard do Parceiro e navegar para a aba "Expansão por Equipes".
- Confirmar que o conteúdo (indicadores de pontos e equipes) aparece corretamente.
