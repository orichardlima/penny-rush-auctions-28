

# Painel Admin: Visão Global de Bônus de Indicação

## Resumo

Adicionar uma nova aba **"Bônus"** no `AdminPartnerManagement` que mostra todos os `partner_referral_bonuses` da plataforma, com cards de resumo e tabela filtrável por status.

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/components/Admin/AdminReferralBonusesTab.tsx` | **Novo** — componente da aba com cards de stats + tabela |
| `src/components/Admin/AdminPartnerManagement.tsx` | Adicionar TabsTrigger "Bônus" + TabsContent importando o novo componente |

## Detalhes

### AdminReferralBonusesTab.tsx

- Busca todos os registros de `partner_referral_bonuses` (admin tem RLS ALL)
- Usa RPC `get_public_profiles` para resolver nomes dos referrers e referidos
- Join com `partner_contracts` para mostrar plano e aporte

**Cards de resumo (4 cards):**
- Total de bônus (contagem)
- Valor total em bônus
- Disponíveis (valor + contagem)
- Pendentes (valor + contagem)

**Tabela com colunas:**
- Referenciador (nome)
- Indicado (nome)
- Nível
- Valor do Aporte
- % Bônus
- Valor do Bônus
- Status (badge colorido: PENDING/AVAILABLE/PAID)
- Data de liberação
- Data de criação
- Fast Start (badge se `is_fast_start_bonus`)

**Filtros:**
- Dropdown de status (Todos, PENDING, AVAILABLE, PAID)
- Campo de busca por nome

### AdminPartnerManagement.tsx

- Import do novo componente
- Nova `TabsTrigger value="bonuses"` com ícone Gift
- Nova `TabsContent value="bonuses"` renderizando `<AdminReferralBonusesTab />`

