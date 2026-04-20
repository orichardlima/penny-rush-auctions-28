

## Plano final aprovado: Catálogo expandido com estratégia mista de imagens

### 1. Migration de banco

**`product_templates`** — adicionar:
- `image_key` (text, nullable) — caminho no bucket
- `image_source` (text, default `'ai'`) — `'ai'` | `'storage'` | `'manual'`

**`auctions`** — adicionar:
- `image_key` (text, nullable) — copiado do template na criação

**Trigger** em `auctions` (no INSERT) já existente que copia campos do template: estender para incluir `image_key`. Se não existir trigger, ajustar a edge function `auto-replenish-auctions` para copiar `image_key` ao criar leilão.

### 2. Storage

Criar bucket `product-images` (público para leitura):
- `/generated/{template_id}.png` — IA
- `/luxury/{slug}.jpg` — upload manual admin

RLS:
- SELECT: público
- INSERT/UPDATE/DELETE: apenas `is_admin_user(auth.uid())`

Servir com header `cache-control: public, max-age=31536000, immutable` (configurado no upload via `cacheControl: '31536000'`).

### 3. Edge function `generate-template-image`

Recebe `{ template_id, prompt? }`. Validação JWT + admin. Fluxo:
1. Busca template pelo `id`
2. Monta prompt: `"Product photography of {title}, centered, studio lighting, soft shadows, clean white background, high detail, realistic, no text, no watermark, e-commerce style, square format"` (ou usa prompt custom)
3. Chama Lovable AI Gateway (`google/gemini-2.5-flash-image`, `modalities: ['image','text']`)
4. Decodifica base64 → faz upload em `product-images/generated/{template_id}.png` com cache de 1 ano
5. Atualiza `image_url` (URL pública) e `image_source = 'ai'` no template
6. Retorna URL

### 4. Edge function `seed-template-images`

One-shot, validação admin. Varre `product_templates` onde `image_url IS NULL AND image_key IS NULL AND tier IN ('standard','premium')`, chama `generate-template-image` para cada um, com delay de 2s entre chamadas (rate-limit safety). Retorna sumário `{ ok, failed, errors[] }`.

### 5. Migration SQL — seed dos ~60 templates

Distribuição:

| Tier | Qtd | Cooldown | Imagem |
|---|---|---|---|
| Standard | 36 | 0–6h | `image_url=NULL` (preencher via seed-template-images) |
| Premium | 18 | 24–48h | `image_url=NULL` (preencher via seed-template-images) |
| Luxury | 6 | 72–168h | `image_key='luxury/{slug}.jpg'`, `image_source='storage'` |

**Categorias:**
- **Standard (36)**: 8 acessórios mobile, 6 áudio entry, 6 cozinha, 4 gift cards, 4 cosméticos, 4 ferramentas, 4 brinquedos
- **Premium (18)**: 5 smartphones intermediários, 4 áudio premium, 3 games portáteis, 3 smartwatches, 3 eletrodomésticos médios
- **Luxury (6)**: iPhone 16 Pro Max, PS5, MacBook Air M3, TV OLED LG 55", Apple Watch Ultra 2, Sony A6700

Dados financeiros calibrados por tier (bid_cost, market_value, revenue_target, starting_price, bid_increment) seguindo a lógica já existente.

### 6. Helper frontend de resolução

Criar `src/utils/templateImage.ts`:
```ts
export function resolveTemplateImage(t: { image_key?: string | null; image_url?: string | null }) {
  if (t.image_key) return `${SUPABASE_URL}/storage/v1/object/public/product-images/${t.image_key}`;
  return t.image_url ?? '/placeholder.svg';
}
```

Aplicar em:
- `AuctionCard.tsx` (renderização do leilão)
- `ProductTemplatesManager.tsx` (preview admin)
- Qualquer outro local que renderize imagem de template/auction

### 7. UI Admin (`ProductTemplatesManager.tsx`)

Adicionar **sem mexer no que já existe**:
- Input `image_key` (texto, hint: `luxury/iphone-16.jpg`)
- Botão **"Gerar com IA"** ao lado do upload — abre modal com prompt pré-preenchido (editável), chama `generate-template-image`, mostra preview, recarrega lista
- Badge na listagem:
  - 📦 Storage (tem `image_key`)
  - 🤖 IA (tem `image_url` sem `image_key`)
  - ⚠️ Sem imagem (nenhum dos dois)
- Preview da imagem na listagem usando `resolveTemplateImage`

### 8. Lista de uploads manuais (Luxury)

Admin precisa subir no bucket após o seed:
- `luxury/iphone-16-pro-max.jpg`
- `luxury/playstation-5.jpg`
- `luxury/macbook-air-m3.jpg`
- `luxury/tv-oled-lg-55.jpg`
- `luxury/apple-watch-ultra-2.jpg`
- `luxury/sony-a6700.jpg`

Documentado na UI admin via badge ⚠️ até o upload ser feito.

### 9. Ordem de execução

1. Migration: colunas + bucket + RLS
2. Deploy de `generate-template-image` e `seed-template-images`
3. UI admin atualizada (campo, botão, badges, preview)
4. Migration de seed (60 templates)
5. Admin roda `seed-template-images` (botão admin ou chamada manual) para popular Standard/Premium
6. Admin sobe os 6 arquivos Luxury no bucket

### Fora de escopo
- Não altera tiers/cooldown/pesos (já implementado)
- Não altera `auto-replenish-auctions` além de copiar `image_key`
- Não altera UI do usuário final além da resolução transparente da imagem
- Não busca imagens de sites de marca

