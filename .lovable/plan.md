

## Diagnóstico

**Problema 1 — Prompt fraco demais.** O prompt atual passa só o título traduzido literalmente (`"Microfone Lapela USB"` ou `"Furadeira Parafusadeira 12V"`). O Gemini, sem contexto visual nem descrição funcional, "alucina" produtos visualmente parecidos: lapela USB → puck preto redondo (carregador wireless), furadeira → garrafa térmica metálica.

**Problema 2 — Descrição do template ignorada.** A tabela `product_templates` tem a coluna `description` rica (ex.: *"Furadeira sem fio com bateria recarregável e maleta"*) que não é usada na geração. Essa descrição é exatamente o contexto que o modelo precisa para produzir a imagem correta.

**Problema 3 — Tradução pt→en ausente.** O Gemini de imagem é treinado majoritariamente em inglês. Termos técnicos em português ("Furadeira Parafusadeira", "Lapela") podem ser mal interpretados.

**Problema 4 — Fallback genérico piora o resultado.** Quando a tentativa 1 falha por falsa razão (já gerou algo errado), nunca cai no retry — porque a função recebeu uma imagem (errada). O retry só dispara se `imageUrl` estiver vazio. Ou seja: imagem errada é tratada como sucesso.

## Plano de correção

### 1. Reescrever o prompt usando título + descrição + dicionário pt→en
Editar `generate-template-image/index.ts`:

- Ler também a coluna `description` do template (já existe)
- Adicionar dicionário pequeno de termos comuns pt→en (`microfone lapela` → `lavalier clip-on microphone`, `furadeira parafusadeira` → `cordless drill driver with battery`, `caixa de som bluetooth` → `bluetooth portable speaker`, etc.) — ~30-40 entradas cobrindo os 60 templates do seed
- Construir prompt no formato:
  ```
  Professional product photography of a {translated_title}. {translated_description}. Centered on pure white background, studio lighting, soft shadows, sharp focus on the product, photorealistic, e-commerce catalog style, square 1:1, no text, no logo, no watermark, no people.
  ```

### 2. Adicionar negative prompts e reforço de identidade
Incluir reforços como `"the product MUST be a {category_in_english}, do NOT generate any other type of object"` para reduzir alucinação.

### 3. Trocar para modelo de qualidade superior
Usar `google/gemini-3.1-flash-image-preview` (Nano Banana 2 — qualidade pro, velocidade flash) em vez de `gemini-2.5-flash-image`. Mais fiel ao prompt, melhor para fotografia de produto.

### 4. Manter botão "Regenerar" (já existe) para reprocessar templates com imagens ruins
Sem mudança de UI — admin já pode clicar "Gerar com IA" novamente em qualquer template Standard/Premium para sobrescrever.

### 5. Logging do prompt final
Adicionar `console.log` do prompt completo enviado ao Gemini, para diagnosticar futuros desvios visuais.

### Fora de escopo
- Não mexer em Luxury (continua via `image_key`)
- Não alterar UI do admin além do que já existe
- Não alterar fluxo de seed-template-images
- Não alterar `templateImage.ts`, `auto-replenish-auctions` ou qualquer outro arquivo

### Resultado esperado
- "Microfone Lapela USB" → microfone de lapela real com clipe e cabo USB
- "Furadeira Parafusadeira 12V" → furadeira sem fio com mandril e bateria
- Após aprovação, admin clica "Gerar com IA" novamente nos templates problemáticos para regerar

