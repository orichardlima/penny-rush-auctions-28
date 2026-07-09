# Plano: Página de Guia do Parceiro — Central de Performance

## Objetivo
Criar uma página pública didática que ensine os parceiros de expansão a:
1. Compartilhar seu link rastreável (`showdelances.com/r/{codigo}`).
2. Acompanhar métricas e pontuação semanal.
3. Entender o que conta para a elegibilidade aos 100% dos CPAs/repasses.

## Escopo
- Apenas conteúdo/apresentação (frontend). Não alterar regras de negócio, payout, comissões, banco de dados ou configurações existentes.
- Página pública, sem necessidade de login.
- Foco na **nova Central de Performance**, mantendo linguagem compatível com o modo relatório atual (`performance_center_enabled=false`).

## O que será feito

### 1. Nova página: `src/pages/PartnerGuide.tsx`
- Estrutura padrão de página pública: `Header`, `Footer`, `SEOHead`.
- Layout em seções:
  - **Hero explicativo**: título, subtítulo e CTA para área de parceiro (`/parceiro` ou `/minha-parceria`).
  - **Como funciona o link**: exemplo de link pessoal, onde encontrar o código, botão de copiar exemplo (ilustrativo), dicas de compartilhamento (WhatsApp, Instagram, stories, grupos, QR Code futuro).
  - **O que é pontuado**: cards com ícones listando cliques qualificados, cadastros, compras de créditos/lances, participação em leilões, novos parceiros e aportes aprovados — com os pesos padrão configuráveis (0,2; 5; 8; 4; 10; 20).
  - **Como acompanhar**: explicação do painel do parceiro (quando ativo), semana de segunda a domingo, dias ativos, meta semanal e qualificação automática por conversão forte.
  - **Regras antifraude em linguagem simples**: não clicar no próprio link, não gerar cadastros falsos, não usar bots, importância de conversões reais.
  - **FAQ em accordion**: 8–12 perguntas didáticas (ex.: "Posso clicar no meu próprio link?", "Quando a pontuação é atualizada?", "O que é dia ativo?", "Comprovação por print?").
  - **Banner de aviso (modo relatório)**: informar que a Central de Performance está em fase de acompanhamento/observação e que a conexão com os repasses ocorrerá após validação dos dados reais.

### 2. Rota pública em `src/App.tsx`
- Adicionar rota `/guia-parceiro` (ou `/parceiro/guia`, a definir) dentro do `BrowserRouter`, usando `LazyRoute` para consistência com as demais páginas.

### 3. Link de acesso
- Adicionar link no `Footer` para "Guia do Parceiro" ou "Como divulgar".
- Opcionalmente, adicionar link discreto na `PartnerLanding` (página pública de parceiro) próximo ao FAQ existente.
- Não alterar o dashboard logado (`/minha-parceria`) nesta etapa, pois a Central ainda não está visível para parceiros.

### 4. Conteúdo e tom
- Linguagem simples, direta e motivadora.
- Não prometer ganhos específicos.
- Deixar claro que cliques sozinhos não garantem elegibilidade e que conversões reais têm mais peso.

## Não será feito
- Não criar/editar tabelas, RPCs, Edge Functions ou triggers.
- Não alterar `performance_center_enabled`, `performance_tracking_enabled` nem qualquer configuração.
- Não conectar a pontuação ao payout, comissões, contratos, patrocinador ou binário.
- Não criar QR Code real nesta etapa (mencionar como recurso futuro).

## Validação
1. `bun run build` deve passar sem erros de TypeScript.
2. Playwright: acessar `/guia-parceiro` sem login, verificar renderização das seções principais e do FAQ.
3. Verificar que a navegação a partir do `Footer` funciona.

## Pergunta para confirmação
Qual rota prefere?
- `/guia-parceiro` (padrão proposto)
- `/parceiro/guia`
- `/central-performance/guia`

Aguardo confirmação para iniciar a implementação.