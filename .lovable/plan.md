

## Corrigir Pontos Inflacionados de Richard Lima

### Problema
Apos a exclusao de usuarios, os pontos acumulados de Richard nao foram subtraidos. Os valores atuais (1950 esq / 2550 dir) incluem pontos de usuarios que ja nao existem na rede.

### Calculo Correto

A rede atual de Richard:

```text
          Richard Lima
          /          \
   Administrador    Adailton M.
   (Legend=1000)    (Legend=1000)
                         \
                      Luciano Deiro
                      (Legend=1000)
```

- **Perna Esquerda**: Administrador (1000 pts) = **1000 total**
- **Perna Direita**: Adailton (1000) + Luciano (1000) = **2000 total**

### Correcao

Executar UPDATE na tabela `partner_binary_positions` para ajustar os pontos de Richard:

```
UPDATE partner_binary_positions
SET left_points = 1000,
    right_points = 2000,
    total_left_points = 1000,
    total_right_points = 2000
WHERE partner_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b';
```

Isso corrige os pontos para refletir apenas os parceiros que realmente existem na rede. Nenhuma alteracao em codigo ou interface.

