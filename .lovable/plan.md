

## Adicionar filtros e busca à aba de Saques (Admin → Parceiros)

A aba **Saques** em `AdminPartnerManagement.tsx` hoje exibe a lista crua de `withdrawals`, sem nenhum filtro ou busca. Em volume crescente isso fica impraticável. A proposta abaixo adiciona uma barra de filtros logo acima da tabela, sem alterar layout de colunas, ações ou fluxo de aprovação/rejeição/pagamento existente.

### Filtros que serão adicionados

Acima da tabela, em uma linha responsiva (flex-wrap, mobile vira coluna):

1. **Busca textual livre** — input com ícone de lupa que filtra por:
   - Nome do parceiro (`user_name`)
   - E-mail (`user_email`)
   - Chave PIX (`payment_details.pix_key`)
   - ID do saque (curto, primeiros 8 chars)
2. **Status** — Select com opções: `Todos`, `Aguardando Pagamento (APPROVED)`, `Pago (PAID)`, `Rejeitado (REJECTED)`. Default: `Aguardando Pagamento` (caso de uso mais comum do admin é despachar pendentes).
3. **Plano** — Select dinâmico com os planos distintos presentes na lista (`Standard`, `Premium`, `Diamond`, `Legend` — só aparecem opções que existem nos dados). Default: `Todos`.
4. **Tipo de chave PIX** — Select: `Todos`, `CPF`, `CNPJ`, `E-mail`, `Telefone`, `Aleatória`. Default: `Todos`.
5. **Faixa de valor** — dois inputs numéricos compactos: `Min (R$)` e `Max (R$)`. Vazios = sem limite.
6. **Período** — dois inputs `type="date"`: `De` e `Até`, aplicados sobre `requested_at`. Vazios = sem limite.
7. **Botão "Limpar filtros"** — reseta todos os campos ao default.

### Indicadores e UX

- **Contador de resultados** ao lado dos filtros: `Mostrando X de Y solicitações`.
- **Resumo dinâmico** (3 mini-cards inline acima da tabela, baseados no resultado filtrado): `Total filtrado (R$)`, `Líquido a pagar (R$)` (somente APPROVED), `Quantidade`.
- **Ordenação por coluna** clicando no cabeçalho `Valor` e `Data` (toggle asc/desc). Default: `Data desc` (igual ao atual).
- **Persistência leve em URL** via `useSearchParams` — os filtros viram query string (ex.: `?wstatus=APPROVED&plan=Legend`) para que o admin possa compartilhar/voltar ao mesmo recorte.
- Vazio filtrado mostra mensagem específica: "Nenhum saque corresponde aos filtros aplicados" + botão "Limpar filtros".

### O que NÃO muda

- Tabela, colunas, badges de status, botões de ação (`Marcar como Pago`, `Rejeitar`), dialog de confirmação PIX, dialog de rejeição, contagem do badge na `TabsTrigger` (continua sendo `stats.pendingWithdrawals` global, não filtrado).
- Hook `useAdminPartners` — todo o filtro é client-side sobre o array `withdrawals` já carregado (mesma estratégia usada em outras abas do painel).
- Nenhuma mudança de banco de dados, RLS, edge function ou outra aba (Parceiros, Planos, Repasses, Cashflow).
- Comportamento mobile: na largura atual o filtro vira coluna; tabela continua com `overflow-x-auto`.

### Resumo técnico

| Arquivo | Mudança |
|---|---|
| `src/components/Admin/AdminPartnerManagement.tsx` | Dentro de `<TabsContent value="withdrawals">`: adicionar bloco de filtros (Input + 4 Selects + 2 inputs número + 2 inputs data + botão limpar), `useState` para cada filtro, `useMemo` `filteredWithdrawals` que aplica os filtros sobre `withdrawals`, mini-cards de resumo, ordenação clicável e mensagem de vazio filtrado. Substituir `withdrawals.map(...)` por `filteredWithdrawals.map(...)`. |

Sem migrations. Sem alterações em hooks, edge functions ou outras telas. Nenhum efeito colateral em UI/UX fora desta aba.

