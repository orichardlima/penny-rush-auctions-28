

# Fix: Qualificação do Cofre Fúria não atualiza em tempo real

## Causa Raiz

Dois bugs identificados:

### Bug 1 — Replica Identity (Database)

A tabela `fury_vault_qualifications` tem `REPLICA IDENTITY DEFAULT` (apenas primary key). Isso significa que em eventos UPDATE no WAL, o registro antigo só contém a coluna `id`. O filtro Realtime `user_id=eq.{userId}` precisa encontrar `user_id` no registro para fazer o match.

- **INSERT** (primeiro lance): todos os campos estão disponíveis, filtro funciona
- **UPDATE** (lances seguintes): `user_id` não está no old record, filtro falha silenciosamente

Comparação: a tabela `auctions` tem `REPLICA IDENTITY FULL` — por isso o Realtime dela funciona perfeitamente.

### Bug 2 — Stale Closure + Channel Recreation (Frontend)

```text
Linha 165:  if (data.instance && newQual.vault_instance_id !== data.instance.id) return;
Linha 200:  }, [auctionId, user?.id, data.instance?.id]);
```

- `data.instance` na closure é capturado no momento que o useEffect executa
- `data.instance?.id` no array de dependências causa teardown/recreação do canal quando a instância carrega (undefined → UUID), arriscando perda de eventos durante a transição
- Solução: usar um `useRef` para armazenar o instance ID, removendo-o das dependências

## Correções

### 1. Migration SQL

```sql
ALTER TABLE fury_vault_qualifications REPLICA IDENTITY FULL;
```

Uma linha. Garante que UPDATE events incluam todos os campos no WAL, permitindo que o filtro `user_id` funcione.

### 2. Refatorar `useFuryVault.ts`

Mudanças cirúrgicas:

- Adicionar `const instanceIdRef = useRef<string | null>(null)` para rastrear o instance ID
- Atualizar o ref no fetchData e no listener de `fury_vault_instances`
- Na closure do listener de qualifications, usar `instanceIdRef.current` ao invés de `data.instance.id`
- Remover `data.instance?.id` do array de dependências do useEffect (evita recreação desnecessária do canal)

```text
Antes:
  deps: [auctionId, user?.id, data.instance?.id]  ← causa teardown/recreate
  check: data.instance.id                          ← stale closure

Depois:
  deps: [auctionId, user?.id]                      ← canal estável
  check: instanceIdRef.current                     ← sempre atualizado
```

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | `REPLICA IDENTITY FULL` em `fury_vault_qualifications` |
| `src/hooks/useFuryVault.ts` | Ref para instance ID + remover dep do useEffect |

## Sem Impacto Em

- `FuryVaultDisplay.tsx` — nenhuma mudança
- Outros componentes ou workflows — nenhum
- Performance Realtime — `REPLICA IDENTITY FULL` aumenta marginalmente o tamanho do WAL para esta tabela, mas o volume é baixo (1 update por lance, mesma escala que `auctions`)

