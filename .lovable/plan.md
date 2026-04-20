

## Diagnóstico

O problema persiste mesmo após:
- sanitização de marcas
- tradução pt→en
- novo modelo (`gemini-3.1-flash-image-preview`)

A imagem do **Apple Watch SE** (uploaded) mostra um quadrado metálico com botão azul — claramente uma renderização "estilizada de smartwatch genérico" que o filtro do Gemini produz quando o nome `apple watch se` é apagado para `modern smartwatch with rectangular display`. Sem nenhuma referência visual de marca, o modelo "inventa" qualquer objeto compatível com a descrição mínima.

Causas raiz remanescentes:

1. **Sanitização agressiva demais.** A regra `[/\bapple\b/gi, '']` apaga "Apple" depois que `apple watch` já foi substituído. Para Premium com marca forte (Apple Watch SE, AirPods, JBL Charge 5, Sony WH-CH720N, Bose, Galaxy, Xiaomi…), o prompt fica desidratado.
2. **Sem retry quando vem imagem (mesmo errada).** Se o modelo devolveu QUALQUER imagem, encerra. Não há nenhum sinal heurístico para detectar incoerência.
3. **Prompt único pobre.** Não há ancoragem de "shape/material/parts" — só categoria genérica.
4. **Não usa o modelo Pro como fallback de qualidade.** `gemini-3-pro-image-preview` é mais fiel quando o flash falha.

Confirmado pelos prints: lapela → carregador wireless, furadeira → garrafa, Apple Watch SE → bloco metálico. Padrão clássico de prompt fraco + flash de baixa fidelidade.

## Plano de correção

### 1. Sanitização condicional por tier
- **Premium** (com marca): MANTER nome da marca + modelo no prompt (usuário aprovou "continuar com IA"). Marcas conhecidas geralmente passam pelo filtro do Gemini quando combinadas com descrição de produto neutro (sem "official", sem "logo").
- **Standard** (sem marca relevante): aplicar tradução pt→en normalmente.
- **Luxury**: continua bloqueado (image_key).

Parar de apagar palavras isoladas como `apple`, `sony`, `samsung`, `lg`. Apenas remover termos problemáticos como "official", "logo", "branded", "copyrighted".

### 2. Prompt enriquecido com âncoras visuais
Reescrever `buildPrompt`:

```
Professional product photography of {translated_title}.
{translated_description}
Key visual features: {category_anchors[category]}
Pure white background, studio lighting, soft shadows, sharp focus,
photorealistic, e-commerce catalog style, square 1:1.
No text, no logos, no watermarks, no people.
```

`category_anchors` mapa por categoria (smartphones → "rectangular touchscreen device with bezels and back camera bump"; eletronicos+watch → "round or square touchscreen face with strap/band"; ferramentas → "tool body with grip handle and operational head").

### 3. Retry com modelo Pro
Se a 1ª tentativa (flash) retornar imagem, **fazer 2ª chamada com `gemini-3-pro-image-preview`** apenas quando o título contém marca conhecida (lista). Comparar tamanhos: usar a do Pro se >= 80% do flash em bytes (heurística simples de "modelo gerou algo robusto"). Caso contrário usar a do flash mesmo.

Se a 1ª falhar (sem imagem), retry com prompt genérico + Pro.

### 4. Permitir o admin **forçar regeneração com prompt customizado**
A função já aceita `customPrompt` no body — expor um botão "Regerar com prompt" no modal admin que abre um textarea. Útil quando a IA insiste em errar.

### 5. Logging do prompt e do modelo usado
Já tem prompt logado. Adicionar:
- modelo escolhido por tentativa
- tamanho da imagem em bytes
- decisão final (qual tentativa foi salva)

### Fora de escopo
- Não alterar templateImage.ts, auto-replenish, UI do usuário final
- Não mexer no fluxo de seed
- Não bloquear tier Premium (decisão do usuário: continuar com IA)

### Resultado esperado
- "Apple Watch SE 40mm" → smartwatch redondo/quadrado com mostrador e pulseira (modelo Pro produz fidelidade alta com nome de marca presente)
- "Microfone Lapela USB" → microfone clip-on com cabo USB
- "Furadeira Parafusadeira 12V" → furadeira sem fio com mandril
- Admin pode digitar prompt manual quando quiser controle total

