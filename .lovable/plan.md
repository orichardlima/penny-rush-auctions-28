

## Diagnóstico

Os logs da `generate-template-image` mostram a resposta do Gemini sem o campo `images` e com `content: null`:

```
{"choices":[{"message":{"role":"assistant","content":null,"images":undefined}}]}
```

Causa provável: **uso de marca específica no título** (`Sony Alpha A6700 Mirrorless`) acionou filtro de copyright/safety do Gemini, que devolveu uma resposta vazia em vez de imagem. O caso testado pelo usuário é um item **Luxury** — pela arquitetura aprovada, Luxury **não deve** usar IA, mas o botão "Gerar com IA" hoje permite isso e mascara a falha como erro genérico.

## Plano de correção

### 1. Sanitizar o prompt (remover marcas/modelos icônicos)
Antes de chamar o gateway, normalizar o título removendo marcas conhecidas (Sony, Apple, iPhone, PlayStation, Samsung, Nintendo, MacBook, AirPods, LG, Xiaomi etc.) e substituindo por categoria genérica. Exemplos:
- `"Sony Alpha A6700 Mirrorless"` → `"professional mirrorless camera with detachable lens"`
- `"iPhone 16 Pro Max"` → `"premium smartphone with triple camera, titanium finish"`
- `"PlayStation 5"` → `"modern gaming console, white and black, two-tone design"`

Mapeamento mantido em uma constante dentro da edge function. Para títulos sem marca conhecida, usa o título original.

### 2. Retry inteligente com fallback de prompt
Se a primeira chamada retornar resposta sem `images`:
- Refazer 1x com prompt ainda mais genérico (somente categoria + descrição visual neutra)
- Se ainda falhar, retornar erro **explicativo** ao frontend: `"Modelo recusou geração — provavelmente conflito de marca. Use upload manual ou image_key."`

### 3. Bloquear "Gerar com IA" para tier Luxury no frontend
No `ProductTemplatesManager.tsx`, desabilitar o botão "Gerar com IA" quando `tier === 'luxury'`, com tooltip: *"Itens Luxury usam imagem oficial via Image Key, não IA."* Isso reforça a regra arquitetural já aprovada.

### 4. Mensagem de erro mais clara no toast
Substituir o genérico *"Edge Function returned a non-2xx status code"* por mensagens vindas do `error.detail` da função (rate limit, créditos, recusa do modelo, marca bloqueada).

### 5. Logging extra na edge function
Adicionar `console.log` do `finish_reason` e `refusal` da resposta do Gemini para facilitar diagnóstico futuro.

### Fora de escopo
- Não trocar de modelo (o `gemini-2.5-flash-image` continua sendo o padrão)
- Não alterar fluxo de seed-template-images
- Não mexer na resolução de imagem do frontend (`templateImage.ts`)
- Não alterar UI/funcionalidade fora do botão "Gerar com IA" e seu modal

### Resultado esperado
- Standard/Premium voltam a gerar normalmente (títulos genéricos não acionam o filtro)
- Tentativas em Luxury são bloqueadas na UI antes de chamar a função
- Quando o filtro do Gemini bloquear mesmo assim, o admin vê uma mensagem clara em vez de um erro genérico

