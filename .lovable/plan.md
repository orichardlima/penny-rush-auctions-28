

## Reparar a Arvore Binaria de Richard Lima

### Problema Diagnosticado
A exclusao de usuarios intermediarios (feita antes da correcao da edge function) desconectou os filhos de Richard Lima. O estado atual no banco:

| Parceiro | parent_contract_id | position | sponsor |
|---|---|---|---|
| Richard Lima | NULL (raiz) | - | - |
| Administrador | **NULL** (deveria ser Richard) | left | Richard |
| Adailton Mascarenhas | **NULL** (deveria ser Richard) | right | Richard |
| Luciano Deiro | Adailton | right | Adailton |

Richard tem pontos acumulados (1950 esq / 2550 dir) mas `left_child_id` e `right_child_id` sao NULL, entao a arvore aparece vazia na visualizacao.

### Solucao
Executar um SQL de reparo para reconectar os nos orfaos de volta a Richard:

1. **Reconectar Administrador** como filho esquerdo de Richard
   - Atualizar `parent_contract_id` do Administrador para Richard
   - Atualizar `left_child_id` de Richard para Administrador

2. **Reconectar Adailton Mascarenhas** como filho direito de Richard
   - Atualizar `parent_contract_id` do Adailton para Richard
   - Atualizar `right_child_id` de Richard para Adailton

### Detalhes Tecnicos

Sera executada uma unica migracao SQL com os seguintes comandos:

```
-- Reconectar Administrador como filho esquerdo de Richard
UPDATE partner_binary_positions
SET parent_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b'
WHERE partner_contract_id = '1de6fd0d-030c-4501-b022-dacb8108d869';

-- Reconectar Adailton como filho direito de Richard
UPDATE partner_binary_positions
SET parent_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b'
WHERE partner_contract_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e';

-- Atualizar referencias de filhos em Richard
UPDATE partner_binary_positions
SET left_child_id = '1de6fd0d-030c-4501-b022-dacb8108d869',
    right_child_id = '9d9db00f-5d02-4e44-8f32-a771220c8b1e'
WHERE partner_contract_id = 'c42ad205-3e35-40ff-a292-c888a6a5011b';
```

Isso restaura a arvore ao estado correto sem alterar pontos (que ja estao consistentes). Nenhuma alteracao em codigo, componentes ou edge functions - apenas reparo de dados.
