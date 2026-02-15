

## Correcao de Pontuacao - Mover 1000 pts do Luciano para nova linha ascendente

### Resumo

Os 1000 pontos do plano Legend do Luciano foram propagados pela linha ascendente antiga (Binario 9 > Binario 8 > Richard Lima). Precisamos remover esses pontos da linha antiga e propaga-los pela nova linha (Adailton > Binario 8 > Richard Lima).

### Situacao Atual dos Pontos

| Parceiro | left_points | right_points | Observacao |
|----------|-------------|--------------|------------|
| Binario 9 (a797b7e7) | 1000 | 0 | Recebeu 1000 na esquerda (Luciano antigo) |
| Binario 8 (d0190e00) | 1400 | 1000 | Recebeu 1000 na esquerda (via Binario 9) |
| Adailton (9d9db00f) | 0 | 0 | Nao recebeu nada ainda |
| Richard Lima (c42ad205) | 1950 | 2550 | Recebeu 1000 na direita (via Binario 8) |

### Alteracoes Necessarias

**1. Remover pontos da linha antiga:**

| Parceiro | Campo | De | Para |
|----------|-------|----|------|
| Binario 9 | left_points, total_left_points | 1000 | 0 |
| Binario 8 | left_points | 1400 | 400 |

**2. Adicionar pontos na nova linha:**

| Parceiro | Campo | De | Para |
|----------|-------|----|------|
| Adailton | right_points, total_right_points | 0 | 1000 |
| Binario 8 | right_points | 1000 | 2000 |

**3. Richard Lima (raiz):** Sem alteracao -- os 1000 pontos saem da esquerda via Binario 9 e entram pela direita via Adailton, mas como Binario 8 esta na direita de Richard Lima, o ponto ja chegava pela direita. O resultado liquido e zero (remove 1000 right, adiciona 1000 right).

**4. Atualizar logs de pontos:** Inserir novos registros no `binary_points_log` para a nova propagacao e manter os antigos como historico.

### Operacoes SQL (5 UPDATEs + 2 INSERTs)

1. Binario 9: `left_points = 0, total_left_points = 0`
2. Binario 8: `left_points = 400, right_points = 2000`
3. Adailton: `right_points = 1000, total_right_points = 1000`
4. Inserir 2 registros no `binary_points_log` (Adailton right +1000, Binario 8 right +1000)

### O Que NAO Muda

- Pontos proprios de cada parceiro
- Nenhum codigo, interface ou schema e alterado
- Richard Lima mantem os mesmos pontos (efeito liquido zero)

