

## Por que o saque de R$ 500 do João não aparece na aba Saques

### Diagnóstico

Confirmei no banco — o saque existe e está íntegro:

| Campo | Valor |
|---|---|
| ID | `8e62f68f-f566-4adb-b638-87b4e3b8dbb6` |
| Parceiro | João Batista Sena Nascimento (Legend, 2 cotas) |
| Valor | R$ 500,00 (líquido R$ 500,00, sem taxa) |
| **Solicitado em** | **06/04/2026** (não 12/04 — a confusão pode ser com a data do payout que originou o saldo, semana 06–12/04) |
| Aprovado em | 06/04/2026 |
| **Pago em** | **19/04/2026** |
| **Status** | **PAID** |

### Por que ele sumiu da tela

Na implementação da aba de filtros que aprovamos no plano anterior, o **Status default ficou em `Aguardando Pagamento (APPROVED)`** — porque é o caso de uso mais comum do admin (despachar pendentes). Como esse saque já está **PAID**, ele é filtrado para fora da visualização inicial.

Existem 2 razões adicionais que podem estar contribuindo:

1. **Filtro de Status** — está em "Aguardando Pagamento", então tudo que é PAID/REJECTED some.
2. **Sem indicação visual clara** do filtro ativo — o admin não percebe que está olhando uma fatia, e não o total.

### Como ver o saque agora (sem mudar código)

Na aba Saques:
- Trocar o filtro **Status** para `Pago (PAID)` ou `Todos` → o saque de R$ 500 aparece imediatamente.
- Alternativamente, digitar `joão` ou `500` na busca (mas com Status filtrando, ainda some — precisa relaxar o Status primeiro).

### Ação recomendada (melhoria de UX da aba)

Pequenos ajustes em `src/components/Admin/AdminPartnerManagement.tsx`, dentro de `<TabsContent value="withdrawals">`:

1. **Mudar o default do filtro Status para `Todos`** em vez de `APPROVED`. Razão: hoje o admin abre a aba e acha que "sumiram" saques antigos. Mostrar tudo por padrão é menos surpreendente. Quem quiser ver só pendentes filtra em 1 clique.
2. **Banner/aviso visível quando há filtro ativo escondendo registros**: logo abaixo da barra de filtros, mostrar uma linha discreta tipo *"Filtros ativos escondendo X solicitações — [Limpar filtros]"* sempre que `filteredWithdrawals.length < withdrawals.length`. Já temos o botão "Limpar filtros"; isto só torna o estado explícito.
3. **Ordenação default por `created_at desc`** continua igual (já está), garantindo que os mais recentes apareçam no topo independente do status.

### O que NÃO muda

- Lógica de filtros, busca textual, ordenação clicável, mini-cards de resumo, persistência em URL — tudo permanece como implementado.
- Tabela, colunas, ações (Marcar como Pago / Rejeitar), badges, dialogs.
- Hooks, RLS, banco, edge functions.

### Resumo técnico

| Arquivo | Mudança |
|---|---|
| `src/components/Admin/AdminPartnerManagement.tsx` | (a) trocar default `useState` do filtro `wstatus` de `'APPROVED'` para `'all'`; (b) ajustar leitura inicial do `useSearchParams` para o mesmo default; (c) adicionar 1 linha condicional acima da tabela exibindo "Filtros ativos escondendo N solicitações" + botão Limpar quando `filteredWithdrawals.length < withdrawals.length`. |

Sem migrations. Sem alterações em outras telas, hooks ou banco.

