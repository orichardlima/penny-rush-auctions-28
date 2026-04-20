

## Diagnóstico: 3 leilões repetidos do mesmo item (Fone JBL Tune 510BT)

### O que aconteceu
Os prints mostram 3 leilões idênticos do "Fone JBL Tune 510BT" finalizados em janela de ~9 minutos (21:37, 21:41, 21:46), todos com 2 participantes e R$ 0,02. Isso é causado pela função de **auto-replenish** (`auto-replenish-auctions`) que cria novos leilões automaticamente sem deduplicar pelo título/template.

### Investigação necessária
Preciso confirmar a causa exata olhando:
1. `supabase/functions/auto-replenish-auctions/index.ts` — verificar se há lógica de dedup
2. `useProductTemplates.ts` / `BatchAuctionGenerator.tsx` — verificar seleção de template
3. Logs recentes da função de replenish + query de leilões criados nos últimos 30min agrupados por título
4. Configuração `system_settings` que controla o replenish (frequência, quantidade alvo)

### Hipóteses prováveis
- **A:** auto-replenish escolhe template aleatório sem checar se já existe leilão ativo/recente com o mesmo `template_id`
- **B:** cron está rodando com intervalo curto e cria múltiplos leilões em cada execução pegando o mesmo template
- **C:** após você regerar imagens em lote, algum trigger ou seed disparou criação em cascata

### Plano de correção (após diagnóstico)

**1. Adicionar dedup no auto-replenish**
- Antes de criar leilão a partir de um template, checar se já existe leilão `active`/`waiting` ou recém-finalizado (<2h) com o mesmo `template_id` ou mesmo `title`
- Pular templates duplicados e pegar o próximo disponível
- Se todos templates do tier estiverem em uso, não criar nada (não forçar duplicata)

**2. Index único parcial no banco**
- Criar índice único parcial em `auctions(template_id) WHERE status IN ('active','waiting')` para garantir no nível DB que não existem 2 leilões ativos simultâneos do mesmo template
- Evita race condition entre múltiplas execuções do cron

**3. Limpar os 2 leilões duplicados existentes (opcional)**
- Apenas se ainda estiverem visíveis, esconder via `is_hidden = true` os 2 mais antigos para não poluir a home

### Fora de escopo
- Não alterar lógica de bots, finalização, RLS ou UI do usuário
- Não mexer em templates, geração de imagens ou seed
- Não alterar a função `place_bid`

### Próximo passo
Após sua aprovação, vou ler os arquivos do auto-replenish, consultar os leilões criados nas últimas 2h agrupados por template/título, e implementar a dedup + índice único.

