

## Correção definitiva: Leilões antigos aparecendo na produção

### Diagnóstico

Existem **dois problemas** causando a exibição de leilões antigos no site de produção:

**Problema 1 - Código não publicado:**
A correção feita no `AuctionRealtimeContext.tsx` (trocar `updated_at.gte` por `finished_at.gte`) foi aplicada apenas no ambiente de teste. O site de produção (`penny-rush-auctions-28.lovable.app`) continua rodando a versão antiga que usa `updated_at` como filtro.

**Problema 2 - Segundo arquivo com o mesmo bug:**
O arquivo `src/hooks/useAuctionData.ts` na linha 155 ainda contém o filtro antigo com `updated_at.gte`. Embora as páginas principais (Index e Auctions) usem o `AuctionRealtimeContext`, esse hook pode ser importado no futuro e reintroduziria o bug.

### Solução

#### Passo 1: Corrigir `src/hooks/useAuctionData.ts`

Alterar a linha 155 de:

```text
query = query.or(`status.in.(active,waiting),and(status.eq.finished,updated_at.gte.${cutoffTime},is_hidden.eq.false)`);
```

Para:

```text
query = query.or(`status.in.(active,waiting),and(status.eq.finished,finished_at.gte.${cutoffTime},is_hidden.eq.false)`);
```

#### Passo 2: Publicar para produção

Apos a correção do segundo arquivo, o usuário precisa publicar o projeto para que ambas as correções entrem em vigor no site de produção.

### O que NAO muda

- Nenhum outro componente ou funcionalidade e alterado
- A lógica de ordenação permanece identica
- Nenhuma migration SQL e necessária
- A configuração `finished_auctions_display_hours` (atualmente 12 horas) continua funcionando normalmente

### Resultado esperado

Apenas leilões finalizados nas últimas 12 horas (conforme configuração atual) aparecerão no site, tanto no ambiente de teste quanto na produção após a publicação.

