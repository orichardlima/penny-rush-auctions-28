

# Adicionar aba "Ranking de Graduações" no Gerenciamento de Parceiros

## Situação atual

O `PartnerGraduationManager` (aba "Graduações" no painel admin) permite apenas **configurar** os níveis de graduação, pontos por plano e simular cenários. Não existe nenhuma tela onde o admin veja **quais parceiros reais** estão em cada nível de graduação.

Os dados já existem no banco: `partner_binary_positions` tem `left_points` e `right_points`, e a perna menor (`LEAST(left_points, right_points)`) define a graduação do parceiro. Basta cruzar com os níveis configurados em `partner_levels`.

## Solução

Adicionar uma **nova aba "Parceiros Graduados"** dentro do `PartnerGraduationManager`, ao lado das abas existentes (Graduações, Pontos por Plano, Simulador).

### O que a aba mostrará

1. **Cards de resumo** por nível de graduação: quantos parceiros estão em cada nível
2. **Tabela completa** com todos os parceiros ativos, mostrando:
   - Nome do parceiro
   - Plano contratado
   - Pontos esquerda / direita
   - Perna menor (pontos de graduação)
   - Nível atual (com badge/ícone)
   - Próximo nível e pontos faltantes
   - Progresso visual (barra)
3. **Filtros**: por nível de graduação e busca por nome
4. **Ordenação**: por pontos de graduação (maior → menor)

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/Admin/PartnerGraduationManager.tsx` | Adicionar aba "Parceiros Graduados" com query ao banco, cards de resumo e tabela ranqueada |

### Dados utilizados (query)
```text
partner_contracts (ACTIVE) 
  + profiles (full_name)
  + partner_binary_positions (left_points, right_points)
  + partner_levels (para mapear pontos → nível)
```

Toda a lógica ficará no mesmo componente, reutilizando os `levels` já carregados pelo hook `useAdminPartnerLevels`.

