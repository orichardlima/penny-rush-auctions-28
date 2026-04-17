
A página inicial não carrega leilões e o console mostra um padrão muito claro:

```
🔌 [REALTIME-CONTEXT] Status: CHANNEL_ERROR (constante)
⚠️ [REALTIME] Conexão perdida, ativando polling de emergência
🆘 [REALTIME-CONTEXT] Polling de emergência (a cada 5s)
⏰ [REALTIME-CONTEXT] fetchAuctions abortado por timeout
```

Combinado com o erro anterior de login (`AuthRetryableFetchError status 503`), o diagnóstico é o mesmo: o **backend Supabase está com instabilidade transitória** (Realtime caindo + REST com timeout). Isso afeta:
1. Login admin (503 no `/auth/v1/token`)
2. Carregamento de leilões (`fetchAuctions` abortado por timeout)
3. Realtime (CHANNEL_ERROR contínuo)

Não é bug do código — é indisponibilidade do serviço Supabase. Confirmei nos logs que outros logins recentes funcionaram, então a infra do projeto não foi corrompida.

## Plano

### 1. Investigação rápida (read-only)
- Conferir status atual do Supabase (postgres + auth + realtime) via logs analíticos das últimas 30 min para confirmar instabilidade.
- Verificar se há algum leilão `active`/`waiting` no banco — se a tabela estiver vazia, "Nenhum leilão disponível" é o comportamento correto e não há nada a corrigir.
- Conferir últimos `bot_webhook_logs` e `function_edge_logs` para ver se algum cron quebrou e finalizou todos os leilões.

### 2. Diagnóstico esperado
- **Cenário A (mais provável):** instabilidade transitória do Supabase → soluções: aguardar, recarregar, limpar localStorage. Nenhuma alteração de código.
- **Cenário B:** todos os leilões finalizaram e nenhum novo foi criado → verificar `auto-replenish-auctions` cron e propor reativação manual de leilões pelo admin.
- **Cenário C:** falha real no `fetchAuctions` (query travando) — improvável dado o padrão de timeout, mas confirmaremos no banco.

### 3. Apresentar relatório ao usuário
- Mostrar o que foi encontrado (status da infra + estado dos leilões).
- Recomendar ação imediata (aguardar / recarregar / acionar admin para repor leilões).
- **Nenhuma alteração de UI, fluxo ou funcionalidade existente** será feita (respeitando a regra do projeto).

### 4. Apenas se cenário B/C for confirmado
- Investigar logs do cron `auto-replenish-auctions` e propor correção pontual (sem alterar UI).

### Arquivos / ações
- Apenas consultas SQL e leitura de logs.
- Nenhuma alteração de código nesta etapa.
