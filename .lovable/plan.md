

## Adicionar Campo de "Pontuação Gerada" ao Modal de Planos

### Problema Atual
Quando o admin cria ou edita um plano, não há campo para informar quantos **pontos** ele gera na rede binária. A pontuação precisa ser configurada separadamente na tab "Pontos por Plano" do PartnerGraduationManager, o que é confuso.

### Solução
Adicionar um campo numérico **"Pontos Gerados"** ao modal de criar/editar planos que:
1. Permite configurar os pontos no mesmo local onde se configura o aporte, limite semanal, etc
2. Ao criar um plano, também insere um registro em `partner_level_points` com plan_name e points
3. Ao editar um plano, atualiza o registro em `partner_level_points` correspondente
4. Se o plano não existir em `partner_level_points` ainda, cria um novo registro

### Mudanças Técnicas

**Arquivo**: `src/components/Admin/AdminPartnerManagement.tsx`

1. **Estado de Criar Plano**:
   - Adicionar `binary_points: 0` ao objeto `newPlan` (linhas ~98-108)
   - Adicionar um Input numérico para "Pontos Gerados" no dialog de criação (após o campo de "Bônus de Lances")

2. **Estado de Editar Plano**:
   - Adicionar `binary_points: 0` ao objeto `editingPlan` quando abre o dialog (ele já carrega o plano, mas não tem os pontos)
   - Necessário fazer uma query adicional ao abrir o dialog para buscar os pontos em `partner_level_points`
   - Adicionar um Input numérico no dialog de edição

3. **Função `handleCreatePlan`** (linha ~269):
   - Após criar o plano via `createPlan()`, fazer um INSERT em `partner_level_points` com:
     - `plan_name`: nome do plano
     - `points`: valor informado pelo admin
     - Se já existir uma entrada para esse plano, fazer UPDATE ao invés de INSERT

4. **Função de Atualizar Plano** (linha ~916):
   - Ao atualizar o plano via `updatePlan()`, também fazer UPDATE em `partner_level_points` se o valor mudou

5. **Dialog de Criar Plano** (linhas 682-791):
   - Adicionar campo Input tipo "number" com label "Pontos Gerados"
   - Atualizar o estado `newPlan` ao mudar

6. **Dialog de Editar Plano** (linhas 832-925):
   - Adicionar campo Input tipo "number" com label "Pontos Gerados"
   - Atualizar o estado `editingPlan` ao mudar
   - Buscar os pontos ao abrir o dialog (useEffect dentro do DialogContent ou ao clicar em Editar)

### Fluxo de Dados

```text
Admin cria plano "Legend" com 1200 pontos:
1. Cria registro em partner_plans (aporte, cap, etc)
2. Cria registro em partner_level_points (plan_name="Legend", points=1200)
3. Pronto! O Legend gera 1200 pontos

Admin edita Legend de 1200 para 1500 pontos:
1. Atualiza partner_plans
2. Atualiza partner_level_points (points = 1500)
```

### O Que NÃO Muda
- A tab "Pontos por Plano" no PartnerGraduationManager continua funcionando para ajustes finos
- Nenhuma outra página é alterada
- Sem migrations de banco de dados necessárias
- A lógica de propagação de pontos na rede binária continua igual

