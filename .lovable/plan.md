
## Diagnóstico real

Conectando os pontos:

1. **Aviso do Supabase**: o projeto está esgotando o orçamento de **Disk I/O**. Quando isso acontece, queries ficam lentas → timeout → PostgREST não consegue recarregar o schema cache → erro `PGRST002` em tudo (leilões, pacotes, vencedores).
2. **Conexão `pg_net` zumbi (PID 5104)** travada desde 05/05 + worker `realtime_replication_connection` aguardando `Lock / transactionid` há 7+ min são **sintomas**, não causa raiz — é a sobrecarga de I/O fazendo background workers ficarem presos.
3. **`pg_stat_statements`** confirma quem está consumindo I/O:

   | Query                                          | Chamadas | Total ms      |
   |------------------------------------------------|----------|---------------|
   | INSERT em `bids` (lances)                      | 731.265  | 9.765.633 ms  |
   | UPDATE em `auctions` (após cada lance)         | 733.895  | 2.660.432 ms  |
   | SELECT `profiles` por user_id                  | 325.542  | 804.358 ms    |
   | SELECT últimos lances por auction              | 112      | 285.524 ms    |

4. **Tabela `bids` já tem 605 MB** (218 MB de dados + 387 MB de índices), e está recebendo lances dos bots ininterruptamente. Cada INSERT dispara o trigger `rebuild_auction_last_bidders` + UPDATE em `auctions` + replicação para realtime — tudo isso multiplica I/O.

## Plano de ação (2 frentes)

### Frente 1 — Desbloqueio imediato (urgência: site fora do ar)

Migration única para liberar locks travados:

```sql
-- Termina conexão zumbi do pg_net (>1h ociosa) — pg_net reinicia sozinho
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE application_name LIKE 'pg_net%'
  AND state = 'idle'
  AND backend_start < now() - interval '1 hour';

-- Termina chamadas longas de bot_tick que estão em pg_sleep
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query ILIKE '%bot_tick%pg_sleep%'
  AND now() - query_start > interval '60 seconds';
```

Após isso, o PostgREST recarrega o schema cache e o site volta a responder.

### Frente 2 — Reduzir consumo de I/O (urgência: evitar reincidência)

**Limpeza histórica de `bids` antigos** — a tabela acumula bids de leilões finalizados há semanas/meses. Esses dados não são necessários para o funcionamento do site (apenas estatísticas), e podem ser arquivados/agregados.

Proposta:
```sql
-- Arquivar bids de leilões finalizados há mais de 30 dias
-- (mantém apenas contagens agregadas em auctions.total_bids)
DELETE FROM public.bids
WHERE auction_id IN (
  SELECT id FROM public.auctions
  WHERE status = 'finished'
    AND finished_at < now() - interval '30 days'
);

VACUUM (ANALYZE) public.bids;
```

Isso pode liberar a maior parte dos 605 MB e reduzir drasticamente o tempo dos triggers (menos páginas para escanear).

**⚠️ Confirmar com você antes**: você tem alguma feature de admin/relatório que dependa de bids antigos individuais (histórico detalhado de lance por usuário em leilões antigos)? Se sim, ajusto a janela para 90 dias ou movemos para uma tabela `bids_archive` em vez de deletar.

### Frente 3 — Upgrade de compute (recomendação ao usuário, não código)

Mesmo com a limpeza, o volume contínuo de bots vai continuar gerando I/O alto. O Supabase recomenda upgrade do compute add-on. Isso é decisão sua no painel: https://supabase.com/dashboard/project/tlcdidkkxigofdhxnzzo/settings/compute-and-disk

## Escopo intocado

- Nenhuma mudança em UI, edge functions, hooks, ou lógica de leilões/bots.
- Nenhuma mudança em triggers, RLS, schema de tabelas.
- Trabalho é 100% manutenção de banco.

## Perguntas antes de executar

1. Posso deletar bids de leilões finalizados há **+30 dias**? Ou prefere janela maior (90 dias) ou mover para tabela de arquivo?
2. Sigo direto com a Frente 1 (desbloqueio) agora e a Frente 2 (limpeza) na sequência?
