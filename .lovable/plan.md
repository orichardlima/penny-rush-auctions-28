

## Por que isso aconteceu — diagnóstico completo

### Resposta direta à sua pergunta
**Não foi a regeração de templates nem leilões anunciados simultaneamente.** A causa é **acúmulo de dados históricos somado aos cron jobs de bots rodando a cada 1 minuto**.

### Dados que confirmam

| Métrica | Valor |
|---|---|
| Leilões com `status='finished'` no banco | **884** (desde 13/set/2025) |
| Leilões finalizados nas últimas 48h | 54 |
| Leilões finalizados ainda visíveis (`is_hidden=false`) | **669** |
| Leilões `active` agora | 0 |
| Leilões `waiting` agora | 0 |

A query simples `COUNT(*) FROM bids` deu **timeout** durante essa investigação — confirma que o banco está sufocado em tempo real, não é percepção.

### Cadeia de causa

1. **Tabela `auctions` cresceu para 884 linhas finalizadas** ao longo de 7 meses — sem limpeza/arquivamento
2. A query da home (`useAuctionData.fetchAuctions`) usa um `OR` com `finished_at` + `is_hidden` + `total_bids`. Esse filtro **não tem índice composto** adequado, então faz scan
3. Os 2 cron jobs de bots (`bot_protection_loop` e `execute_overdue_bot_bids`) rodam a cada 60s
4. Quando o scan demora, os crons batem em `statement_timeout` (60s) e ficam empilhados
5. Locks empilham → conexões do PostgREST esgotam → frontend aborta em 20s → **tela vazia**

### Por que os 3 leilões repetidos do "Mi Band" hoje contribuíram
Cada leilão repetido finalizado adiciona ~1-2s de processamento extra (bots, atualização de pontos, triggers de bonus). Hoje à tarde, o cron de auto-replenish criou múltiplos leilões iguais que finalizaram em sequência rápida (sua reclamação anterior). Isso foi a **gota d'água** sobre uma base já lenta — não foi a causa única.

### O que precisa ser feito (plano de correção)

**1. Arquivar leilões antigos (alívio imediato)**
- Marcar como `is_hidden = true` todos os leilões finalizados há mais de 48h (são ~615 registros)
- Reduz o working set da query da home de 669 para ~54 imediatamente

**2. Criar índice composto que cobre a query da home**
```sql
CREATE INDEX CONCURRENTLY idx_auctions_visible_recent
ON auctions (status, finished_at DESC, is_hidden)
WHERE is_hidden = false;
```

**3. Adicionar advisory lock nos cron jobs de bots**
- `bot_protection_loop` e `execute_overdue_bot_bids` ganham `pg_try_advisory_lock` no início
- Se a execução anterior ainda roda, a nova sai imediatamente (não empilha)

**4. Auto-arquivamento via cron diário**
- Job diário às 4h da manhã: `UPDATE auctions SET is_hidden = true WHERE status='finished' AND finished_at < now() - interval '48 hours' AND is_hidden = false`
- Mantém a tabela enxuta sem intervenção manual

### Fora de escopo
- Não deletar leilões (preservar histórico para auditoria)
- Não mexer em RLS, place_bid, UI, fluxo de pagamento, bots ou templates
- Não alterar a lógica de geração/replenish (já corrigida na rodada anterior)

### Resultado esperado
- Query da home retorna em <500ms (hoje aborta em 20s)
- Cron jobs param de empilhar
- Site volta a carregar dados normalmente
- Crescimento futuro controlado pelo auto-arquivamento

### Próximo passo (após sua aprovação)
Aplicar a migration que faz: arquivar antigos + criar índice + agendar cron de arquivamento + adicionar advisory lock nas 2 funções de bots.

