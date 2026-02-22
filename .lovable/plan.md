

# Melhorias Visuais na Arvore Binaria Administrativa

## 1. Cards visuais em vez de linhas de texto

Substituir o layout de lista indentada por cards estruturados para cada no. Cada card tera:
- Nome do parceiro em destaque
- Badge do plano com cor distinta por tipo (Start, Legend, etc.)
- Pontos esquerda/direita com icones e barras visuais proporcionais
- Indicador de sponsor (quem indicou) em texto pequeno

## 2. Cores por perna seguindo a convencao do sistema

Aplicar a convencao visual ja existente:
- **Azul** para a perna esquerda (badge, borda do card)
- **Amarelo/ambar** para a perna direita (badge, borda do card)
- **Verde** para o no raiz

Isso substitui os badges vermelhos genericos atuais.

## 3. Mostrar vagas vazias

Quando um no tem apenas um filho, exibir um placeholder visual (card tracejado/fantasma) na posicao vazia, com texto "Vaga disponivel". Isso permite ao admin ver imediatamente onde ha espaco na rede.

## 4. Barras visuais de pontos

Substituir o texto "E:1.000 D:3.100" por:
- Duas barras horizontais coloridas (azul esquerda, amarela direita)
- Proporcao visual entre elas
- Valores numericos ao lado
- Highlight na perna menor (borda vermelha ou icone de alerta)

## 5. Tooltip com detalhes completos

Ao passar o mouse ou clicar em um no, mostrar um popover com:
- Nome completo e email
- Plano e status do contrato
- Sponsor (quem indicou)
- Parent (pai na arvore)
- Pontos acumulados totais
- Data de entrada na rede

## 6. Linhas de conexao entre nos

Adicionar linhas verticais e horizontais com CSS (border-left + pseudo-elements) para conectar visualmente pai e filhos, tornando a hierarquia mais clara que apenas indentacao.

---

## Detalhes Tecnicos

### Arquivo alterado
- `src/components/Admin/AdminBinaryTreeView.tsx` -- apenas o componente `TreeNodeView` e estilos associados

### Componente TreeNodeView atualizado

O componente `TreeNodeView` sera reescrito para renderizar:

```text
+-- Card com borda colorida (azul/amarela/verde)
|   |-- Nome + Badge do plano
|   |-- Barra de pontos E/D proporcional
|   |-- Texto "Sponsor: Nome" (se diferente do parent)
|   +-- Tooltip com detalhes
|
+-- Filhos com linhas de conexao CSS
    |-- [Card filho esquerdo] ou [Placeholder vazio tracejado]
    +-- [Card filho direito] ou [Placeholder vazio tracejado]
```

### Estilo das linhas de conexao
Usar `border-left` e `::before` pseudo-elements com Tailwind + classes customizadas para desenhar as conexoes visuais da arvore.

### Badges por perna
- Raiz: `bg-green-500 text-white`
- Left: `bg-blue-500 text-white`
- Right: `bg-amber-500 text-white`

### Vagas vazias
Card com `border-dashed border-muted-foreground/30` e texto "Vaga disponivel" em cinza claro.

### Barras de pontos
Duas divs com `h-2 rounded-full` e largura proporcional ao maximo entre left/right points, usando `bg-blue-400` e `bg-amber-400`.

## O que NAO muda

- Nenhuma funcionalidade existente sera alterada (vincular, recalcular, buscar)
- As tabelas de "Parceiros Isolados" e "Todos os Registros" permanecem identicas
- Os summary cards no topo permanecem identicos
- Os dialogs de vinculacao e recalculo permanecem identicos
- Nenhuma query ou hook sera modificado

