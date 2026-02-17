

## Auto-Reposicao de Leiloes - Nunca Ficar com a Home Vazia

### Problema

Atualmente, voce precisa criar leiloes manualmente. Quando todos encerram, a home fica sem leiloes ativos.

### Solucao: Sistema de Auto-Reposicao

Criar uma **Edge Function** (`auto-replenish-auctions`) executada via **cron job a cada 5 minutos** que:

1. Conta quantos leiloes estao `active` ou `waiting`
2. Se a quantidade estiver abaixo de um minimo configuravel (ex: 3), cria novos leiloes automaticamente a partir dos templates ativos
3. Os novos leiloes sao agendados com intervalos entre si para nao iniciar todos ao mesmo tempo

### Configuracoes pelo Admin (system_settings)

Novas configuracoes na tabela `system_settings`:

| Chave | Descricao | Valor Padrao |
|-------|-----------|--------------|
| `auto_replenish_enabled` | Ativar/desativar o sistema | `true` |
| `auto_replenish_min_active` | Minimo de leiloes ativos+waiting | `3` |
| `auto_replenish_batch_size` | Quantos criar de cada vez | `3` |
| `auto_replenish_interval_minutes` | Intervalo entre os novos leiloes | `30` |
| `auto_replenish_duration_hours` | Duracao de cada leilao (ends_at) | `3` |

### UI no Painel Admin

Adicionar uma secao no `SystemSettings.tsx` para o admin ligar/desligar e configurar os parametros acima sem precisar mexer no banco.

### Detalhes Tecnicos

**1. Edge Function `auto-replenish-auctions`**

```text
- Busca settings do system_settings
- Se auto_replenish_enabled = false, retorna sem fazer nada
- Conta leiloes com status IN ('active', 'waiting')
- Se count >= min_active, retorna sem fazer nada
- Calcula quantos faltam: needed = min_active - count
- Limita a batch_size
- Busca templates ativos (is_active = true), embaralha, pega os N primeiros
- Cria leiloes com starts_at escalonado (agora + i * intervalo)
- Cada leilao recebe ends_at = starts_at + duration_hours (com offset aleatorio ±15min)
- Incrementa times_used nos templates usados
```

**2. Cron Job (migracao SQL)**

Agendar via `pg_cron` + `pg_net` para chamar a edge function a cada 5 minutos.

**3. UI no SystemSettings**

Nova secao "Reposicao Automatica de Leiloes" com:
- Toggle on/off
- Campo numerico para minimo de leiloes ativos
- Campo numerico para tamanho do lote
- Select para intervalo entre leiloes
- Select para duracao de cada leilao

**4. Atualizacao do hook useSystemSettings**

Adicionar os novos campos de configuracao.

### Arquivos Modificados/Criados

- `supabase/functions/auto-replenish-auctions/index.ts` (novo) - Edge function
- `supabase/migrations/[nova].sql` - Inserir settings padrao + cron job
- `src/components/SystemSettings.tsx` - Nova secao de configuracao
- `src/hooks/useSystemSettings.ts` - Novos campos

### Fluxo

```text
Cron (5min) --> Edge Function --> Verifica count(active+waiting)
                                    |
                            count < minimo?
                           /              \
                         Sim              Nao --> Nada a fazer
                          |
                   Busca templates ativos
                          |
                   Cria N leiloes escalonados
                          |
                   Home sempre com leiloes!
```

### Impacto

- Nenhuma alteracao nas funcionalidades existentes de leilao
- O admin pode desligar a qualquer momento pelo painel
- Templates existentes sao reutilizados automaticamente
- Os leiloes criados automaticamente funcionam exatamente como os criados manualmente

