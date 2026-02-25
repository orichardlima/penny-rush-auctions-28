

# Análise: Impacto no Realtime

## Canais Existentes no Sistema

| Canal | Tabela | Filtro | Quem usa |
|---|---|---|---|
| `global-auctions-channel` | `auctions` | nenhum (global) | Todos os usuários |
| `fury-vault-{auctionId}` | `fury_vault_instances` | `auction_id=eq.X` | Quem vê leilão |
| `payment-status-{purchaseId}` | `bid_purchases` | `id=eq.X` | 1 usuário (temporário) |
| `partner-upgrade-{contractId}` | `partner_contracts` | `id=eq.X` | 1 usuário (temporário) |

**Total atual: ~4 canais por usuário ativo** (sendo 2 temporários que duram segundos).

## O Que o Plano Adiciona

1. **Habilitar Realtime em `fury_vault_qualifications`** -- isso significa que o Supabase passa a monitorar WAL dessa tabela e broadcast mudanças. Custo: proporcional ao volume de writes nessa tabela.

2. **Novo canal: `fury-vault-qual-{auctionId}-{userId}`** -- filtrado por `user_id`, recebe apenas mudanças do próprio usuário. 1 canal por usuário por leilão visualizado.

## Preocupações Reais

### Volume de WAL
- `fury_vault_qualifications` recebe 1 UPDATE por lance (o trigger `fury_vault_on_bid` faz UPSERT).
- Com Realtime habilitado, **cada lance gera 1 evento WAL broadcast** para essa tabela.
- Se 100 lances/min acontecem num leilão, são 100 eventos/min broadcast pelo Realtime.
- **Porém**: o filtro `user_id=eq.X` faz com que cada cliente receba apenas **seus próprios eventos** (1 a cada X segundos, quando ele próprio dá lance). O broadcast total no servidor é proporcional ao número de lances, mas a entrega por cliente é mínima.

### Comparação com `auctions`
- A tabela `auctions` já recebe UPDATE a cada lance (preço, total_bids, last_bid_at, last_bidders) e é broadcast **sem filtro** para todos os clientes.
- `fury_vault_qualifications` tem o **mesmo volume de writes** que `auctions` (1 por lance), mas com **filtro por user_id**, então o custo de entrega é menor.

### `qualified_count` em `fury_vault_instances`
- O trigger que incrementa `qualified_count` gera um UPDATE adicional em `fury_vault_instances` a cada lance onde `is_qualified` muda de false para true. Isso é raro (acontece 1 vez por usuário quando atinge o threshold, não a cada lance). Impacto negligível.

## Veredicto

**Não sobrecarrega.** O volume de eventos WAL de `fury_vault_qualifications` é idêntico ao de `auctions` (1 por lance), e a entrega é mais eficiente por causa do filtro `user_id`. O canal extra por cliente é leve (filtrado, baixo volume).

O problema que vocês tiveram no passado foi com **canais redundantes e sem filtro** (múltiplos listeners em `bids`, `auctions` sem consolidação). A arquitetura atual já resolveu isso com o canal global único. A adição proposta segue o padrão correto: canal filtrado, baixo volume por cliente.

## Otimização Extra (Opcional)

Se mesmo assim quiser ser conservador, pode-se **reusar o canal existente** `fury-vault-{auctionId}` para escutar as duas tabelas no mesmo canal (Supabase permite múltiplos `.on()` no mesmo canal). Isso evita criar um canal separado:

```text
supabase.channel(`fury-vault-{auctionId}`)
  .on('postgres_changes', { table: 'fury_vault_instances', filter: auction_id=... })  // já existe
  .on('postgres_changes', { table: 'fury_vault_qualifications', filter: user_id=... })  // novo
  .subscribe()
```

Zero canais novos. Apenas um listener adicional no canal existente.

## Resumo

- Volume WAL: igual ao que já existe para `auctions` (1 evento/lance)
- Canais novos: zero se reusar o canal existente
- Entrega por cliente: filtrada por `user_id`, mínima
- Risco de sobrecarga: nenhum

