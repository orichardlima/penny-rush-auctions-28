

# Adicionar aba "Últimas Compras" no Painel Administrativo

## Situação atual

- O admin só vê compras abrindo o modal individual de cada usuário (ícone 🛒)
- Não há visão consolidada de todas as compras recentes da plataforma

## O que será criado

Uma nova aba **"Compras"** no `AdminDashboard` que exibe uma tabela com todas as compras de lances (`bid_purchases`) ordenadas por data, com:

- Nome do usuário (join com `profiles`)
- Pacote comprado (join com `bid_packages`)
- Quantidade de lances
- Valor pago
- Status do pagamento
- Data/hora
- Filtros por período e status
- Paginação (20 por página)

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/AdminDashboard/RecentPurchasesTab.tsx` | Novo componente com tabela de compras globais |
| `src/components/AdminDashboard.tsx` | Adicionar nova aba "Compras" com lazy loading |

## Detalhes técnicos

### RecentPurchasesTab.tsx
- Query no `bid_purchases` com join em `profiles(full_name)` e `bid_packages(name)`
- Paginação server-side via `.range()`
- Filtros: período (7d, 30d, 90d, todos) e status (completed, pending, failed)
- Cards de resumo no topo: total de compras, receita total, lances vendidos (apenas status `completed`)

### AdminDashboard.tsx
- Adicionar `TabsTrigger` "Compras" com ícone `ShoppingCart`
- Lazy render igual às outras abas (só carrega quando selecionada)

