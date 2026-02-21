

# Plano: Visao Detalhada por Parceiro no Painel Admin

## Objetivo

Adicionar um botao "Ver detalhes" em cada linha da tabela de contratos no admin. Ao clicar, abre um modal com o resumo consolidado de todos os ganhos do parceiro: repasses, bonus de indicacao, bonus binario, creditos manuais e saques, com totais e historico.

## O que sera criado

### 1. Novo componente: `PartnerDetailModal.tsx`

Um modal (Dialog) que recebe o `contract` selecionado e busca todos os dados financeiros do parceiro:

**Dados buscados (por `partner_contract_id`):**
- `partner_payouts` - repasses semanais (pagos e pendentes)
- `partner_referral_bonuses` - bonus de indicacao (por `referrer_contract_id`)
- `binary_bonuses` - bonus binarios
- `partner_manual_credits` - creditos manuais do admin
- `partner_withdrawals` - saques solicitados

**Layout do modal:**
- Cabecalho com nome do parceiro, plano, aporte e status
- Cards de resumo: Total Repasses, Total Bonus Indicacao, Total Bonus Binario, Total Creditos Manuais, Total Saques, Saldo Disponivel
- Abas (Tabs) com historico detalhado de cada tipo:
  - Repasses: tabela com semana, valor, status, data pagamento
  - Bonus Indicacao: tabela com indicado, nivel, %, valor, status
  - Bonus Binario: tabela com ciclo, pontos, valor, status
  - Creditos Manuais: tabela com tipo, descricao, valor, data
  - Saques: tabela com valor, status, data solicitacao, data pagamento

### 2. Alteracao em `AdminPartnerManagement.tsx`

- Adicionar estado para controlar o modal (`selectedPartnerForDetail`)
- Adicionar botao com icone `Eye` na coluna de acoes de cada contrato
- Renderizar o `PartnerDetailModal` quando um parceiro for selecionado

## Detalhes Tecnicos

### Arquivo novo: `src/components/Admin/PartnerDetailModal.tsx`

- Recebe props: `contract` (dados do contrato), `open` (boolean), `onClose` (callback)
- Usa `useEffect` para buscar dados ao abrir, com `Promise.all` para queries paralelas
- Todas as queries filtram por `partner_contract_id = contract.id`
- Para bonus de indicacao, filtra por `referrer_contract_id = contract.id`
- Exibe totais calculados no frontend
- Usa componentes existentes: Dialog, Card, Tabs, Table, Badge

### Arquivo alterado: `src/components/Admin/AdminPartnerManagement.tsx`

- Adiciona estado: `const [selectedPartnerForDetail, setSelectedPartnerForDetail] = useState<any>(null)`
- Na coluna de acoes da tabela de contratos (linha ~664), adiciona um novo botao `Eye` antes dos botoes existentes
- Renderiza `<PartnerDetailModal>` no final do componente

### Nenhuma alteracao no banco de dados

Todas as tabelas necessarias ja existem e as politicas RLS para admins ja permitem acesso total (ALL com `is_admin_user(auth.uid())`).

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/Admin/PartnerDetailModal.tsx` | Criar (modal com resumo e historico) |
| `src/components/Admin/AdminPartnerManagement.tsx` | Alterar (adicionar botao + importar modal) |

