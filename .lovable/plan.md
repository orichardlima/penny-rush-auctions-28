

## Permitir geração de imagens com IA para itens Luxury

Hoje o pipeline de geração de imagens já funciona tecnicamente para qualquer tier — o bloqueio para `luxury` existe apenas no frontend e nas funções de seed/batch. A regra original era: Luxury usa imagem oficial via `image_key` (storage). Com esta mudança, Luxury continuará podendo usar `image_key`, mas também poderá gerar imagem com IA quando o admin quiser.

### O que muda

**1. Editor de template (`src/components/Admin/ProductTemplatesManager.tsx`)**
- Remover `formData.tier === 'luxury'` das condições `disabled` dos botões "Gerar com IA" e "Prompt".
- Remover o `title` tooltip que diz que Luxury não pode gerar.
- Remover o parágrafo de aviso "Itens Luxury usam imagem oficial via Image Key — não geram com IA".
- Manter intacto o campo `image_key` (Luxury ainda pode optar pela imagem oficial).

**2. Gerador em lote (`src/components/Admin/BatchTemplateImageGenerator.tsx`)**
- Remover o filtro `if (t.tier === 'luxury') return false` do `useMemo` de candidatos.
- Adicionar `'luxury'` ao select de Tier (ex.: `Standard + Premium + Luxury`, `Apenas Luxury`).
- Atualizar a nota informativa: trocar "Itens Luxury são ignorados…" por uma observação dizendo que Luxury também pode ser regerado com IA, e que itens com `image_key` definido permanecerão usando a imagem oficial a menos que o admin sobrescreva manualmente.

**3. Função de seed em massa (`supabase/functions/seed-template-images/index.ts`)**
- Trocar `.in('tier', ['standard', 'premium'])` por `.in('tier', ['standard', 'premium', 'luxury'])` para que a varredura de pendentes inclua Luxury sem `image_url` e sem `image_key`.

**4. Backend `generate-template-image`**
- Sem mudanças. Já aceita qualquer tier; a função apenas lê `tier` para log/contexto e gera normalmente.

### O que NÃO muda

- A lógica de resolução de imagem (`src/utils/templateImage.ts`) permanece: se houver `image_key`, usa storage oficial; caso contrário, usa `image_url` (que pode agora vir da IA mesmo para Luxury).
- Frequência de aparição em leilões (peso baixo de Luxury), tempo de cooldown, badges e demais regras de negócio para Luxury seguem inalteradas.
- Nenhuma alteração de banco de dados / RLS / cron / triggers.
- Nenhuma alteração em UI fora do painel administrativo de templates.

### Resumo técnico das edições

| Arquivo | Tipo de mudança |
|---|---|
| `src/components/Admin/ProductTemplatesManager.tsx` | Remover guards `tier === 'luxury'` em 2 botões e 1 aviso |
| `src/components/Admin/BatchTemplateImageGenerator.tsx` | Remover filtro Luxury, adicionar opção no select, atualizar copy |
| `supabase/functions/seed-template-images/index.ts` | Incluir `'luxury'` no `.in('tier', …)` |

Nenhuma migration necessária. Nenhuma mudança em fluxo de leilão, bots, pagamentos ou autenticação.

