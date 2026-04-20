

## Diagnóstico

Os logs mostram o erro real, repetido em todas as tentativas do lote:

```
ERROR [attempt=1] 402 {"type":"payment_required","message":"Not enough credits","details":""}
```

**Não é bug de código.** O Lovable AI Gateway acabou de retornar **créditos esgotados** no workspace. Cada chamada da `generate-template-image` gasta crédito (e ainda mais quando dispara o retry com `gemini-3-pro-image-preview` para itens com marca como "Samsung Galaxy", "Xiaomi Redmi"). O lote de 41 templates Standard+Premium consome muito rápido.

A UI está mostrando "Edge Function returned a non-2xx" porque o `supabase.functions.invoke` esconde o body de erro 402. A mensagem real ("Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.") já existe na função mas não aparece na lista de progresso.

Adicionalmente, o batch atual:
- Não para quando detecta 402 (continua tentando os 41 e falhando todos, queimando tempo)
- Não diferencia 402 (erro de billing) de erros reais de geração

## Plano de correção

### 1. Capturar e exibir o erro real do servidor no batch
Em `BatchTemplateImageGenerator.tsx`, ao invocar a edge function, ler `data?.error` mesmo quando vier `non-2xx`. Hoje o catch genérico mostra `error.message` ("Edge Function returned a non-2xx"). Trocar pela mensagem específica retornada pela função (`Créditos esgotados...`, `Limite de requisições...`, `O modelo recusou...`).

### 2. Auto-abortar o lote ao detectar 402 (créditos)
Se a primeira resposta vier com erro de créditos, parar o loop imediatamente e mostrar um aviso destacado:
> "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage e tente novamente."

Itens restantes ficam marcados como `pending` (não como `failed`), para deixar claro que não foram tentados.

### 3. Tratamento idêntico para 429 (rate limit)
Se vier 429, parar o lote também e mostrar:
> "Limite de requisições atingido. Aguarde alguns minutos e reinicie o lote."

### 4. (Opcional) Exibir badge de status de créditos no topo do dialog
Pequeno aviso textual: "Cada imagem consome ~1 crédito de IA. Lote de 41 itens pode consumir até ~80 créditos (com retry para marcas)."

### Fora de escopo
- Não alterar a edge function `generate-template-image` (lógica está correta — falha é externa, billing)
- Não alterar templates, schema, UI fora do dialog de batch
- Não tentar contornar o billing (impossível e indesejado)

### Ação para o usuário
1. Adicionar créditos em **Settings → Workspace → Usage** no Lovable
2. Após créditos disponíveis, abrir o dialog "Regerar em Lote" novamente — o loop continuará funcionando com a nova lógica de detecção de billing

### Resultado esperado
- Lote para imediatamente ao detectar billing/rate-limit (em vez de queimar 40 falhas)
- Mensagem de erro humana e clara explicando o motivo real
- Admin entende exatamente o que precisa fazer (adicionar créditos)

