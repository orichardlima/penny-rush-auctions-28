

## Plano: Regerar templates ruins em lote

### Objetivo
Permitir ao admin regerar imagens via IA para múltiplos templates Standard/Premium de uma vez, usando a nova lógica já implantada (sanitização suave + âncoras visuais + dual-model fallback).

### Arquitetura

**1. Nova edge function `batch-regenerate-templates`**
- Aceita body opcional: `{ tier?: 'standard' | 'premium' | 'all', categoryFilter?: string, onlyMissing?: boolean, templateIds?: string[] }`
- Carrega templates do banco (excluindo `luxury` por padrão)
- Para cada template, chama internamente a mesma lógica da `generate-template-image` (refatorar trecho de geração para função compartilhada ou reutilizar via fetch interna)
- Processa em série com pequeno delay (800ms) para não estourar rate limit do Lovable AI Gateway
- Retorna progresso final: `{ total, success, failed, items: [{id, title, status, model, error?}] }`
- Verifica admin via JWT antes de iniciar

**2. Novo botão "Regerar em Lote" no `ProductTemplatesManager.tsx`**
- Abre um `Dialog` com:
  - Filtros: tier (Standard / Premium / Ambos), categoria (select com `TEMPLATE_CATEGORIES`)
  - Checkbox: "Apenas templates sem imagem"
  - Preview do total de templates que serão afetados (count via filtro local)
  - Botão "Iniciar Regeração"
- Durante execução: barra de progresso + log em tempo real (lista de itens processados com ✓ ou ✗)
- Implementação: chamada única à edge function com timeout estendido; UI mostra resultado consolidado ao terminar
- Após conclusão: `fetchTemplates()` recarrega lista + toast com resumo (`X regerados, Y falharam`)

**3. Bloqueios e segurança**
- Edge function rejeita `tier='luxury'` (mantém regra de imagem oficial via `image_key`)
- UI desabilita botão se já houver outro lote rodando (estado local)
- Limite máximo de 50 templates por lote (evita timeout de edge function)

### Logging
- Cada item: `console.log` com id, título, modelo escolhido, tamanho da imagem
- Resumo final no log da função

### Fora de escopo
- Não alterar lógica interna da geração (já corrigida na rodada anterior)
- Não mexer em UI de usuário final, fluxo de seed, auto-replenish ou Luxury
- Não criar tabela nova de jobs/queue (processamento síncrono já é suficiente para 60 templates)

### Resultado esperado
Admin abre o modal, escolhe "Standard + Premium / Todas categorias", clica "Iniciar" e em ~1-2 minutos vê todos os templates com imagens novas geradas pela lógica corrigida.

