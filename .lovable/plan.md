

## Filtros para a Tabela de Contratos de Parceiros

### O que sera feito
Adicionar filtros acima da tabela "Todos os Contratos" na aba Contratos do Gerenciamento de Parceiros, permitindo buscar e filtrar contratos de forma rapida.

### Filtros propostos
1. **Busca por nome/email** - Campo de texto para buscar pelo nome ou email do parceiro
2. **Filtro por Plano** - Select com todos os planos disponiveis (Start, Pro, Elite, Legend, etc.)
3. **Filtro por Status** - Select com as opcoes: Todos, Ativo, Suspenso, Encerrado, Pendente
4. **Botao "Limpar Filtros"** - Para resetar todos os filtros de uma vez

### Como vai funcionar
- Os filtros serao combinaveis (AND): busca + plano + status funcionam juntos
- A lista sera filtrada em tempo real no frontend (sem nova chamada ao banco)
- O contador de resultados sera exibido (ex: "Exibindo 5 de 13 contratos")
- O CSV exportara apenas os contratos filtrados (nao todos)

### Detalhes Tecnicos

**Arquivo:** `src/components/Admin/AdminPartnerManagement.tsx`

1. **Novos estados** (junto aos estados existentes, ~linha 90):
   - `contractSearch: string` - texto de busca
   - `contractStatusFilter: string` - filtro de status ('all' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'PENDING')
   - `contractPlanFilter: string` - filtro de plano ('all' | nome do plano)

2. **Novo useMemo** para contratos filtrados:
   ```
   filteredContracts = contracts filtrados por:
     - search (nome ou email, case-insensitive)
     - status (se diferente de 'all')
     - plan_name (se diferente de 'all')
   ```

3. **UI dos filtros** - Inseridos entre o CardHeader e a Table (linha ~543), com:
   - Input de busca com icone de lupa
   - Select de Status
   - Select de Plano (populado dinamicamente a partir dos planos existentes)
   - Botao "Limpar" (visivel apenas quando ha filtros ativos)
   - Texto "Exibindo X de Y contratos"

4. **Substituir** `contracts.map(...)` por `filteredContracts.map(...)` na tabela

5. **Ajustar exportCSV** para usar `filteredContracts` em vez de `contracts`

6. **Nenhuma alteracao** em outros componentes, hooks, banco de dados ou edge functions.
