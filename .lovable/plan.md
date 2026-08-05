# Plano de Correção: Falha de Carregamento na Aba "Expansão por Equipes"

O usuário relatou que a página não carrega ao clicar na aba "Expansão por Equipes". Investigação inicial identificou arquivos JavaScript compilados (`.js`) coexistindo com arquivos TypeScript (`.ts`/`.tsx`), o que causa conflitos de importação no ambiente de desenvolvimento do Vite/Lovable, gerando o erro "Página não carregou".

## Diagnóstico
- Foi encontrado o arquivo `src/hooks/useExpansionCareer.js` em conflito com `src/hooks/useExpansionCareer.ts`.
- Embora o arquivo `ExpansionProgramSection.js` não tenha sido listado no `ls` anterior, o sintoma é idêntico a um problema corrigido anteriormente onde arquivos `.js` gerados acidentalmente bloqueavam a renderização de componentes React.
- A estrutura de abas no `PartnerDashboard.tsx` está correta, mas a renderização do conteúdo da aba depende dos hooks `useExpansionProgram` e `useExpansionCareer`.

## Ações Propostas

### 1. Limpeza de Arquivos Intrusionais (Execução)
Remover todos os arquivos `.js` que possuem equivalentes `.ts` ou `.tsx` nas pastas afetadas para garantir que o compilador use as versões corretas.

### 2. Validação de Importações e Tipagem
Verificar se `PartnerDashboard.tsx` e `ExpansionProgramSection.tsx` estão importando corretamente dos arquivos `.ts`.

### 3. Tratamento de Erro Robusto
Adicionar um `ErrorBoundary` ou tratamento de erro específico no `ExpansionProgramSection.tsx` para evitar que uma falha no carregamento dos dados do programa trave toda a interface do parceiro.

## Teste de Verificação
- Acessar a rota `/` (Dashboard do Parceiro).
- Clicar na aba "Expansão por Equipes".
- Verificar se o componente `ExpansionProgramSection` renderiza corretamente (mesmo que mostre um estado vazio ou alerta, não deve travar a página).
