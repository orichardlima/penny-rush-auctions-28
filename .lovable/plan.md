## Objetivo

Na página `/meus-contratos`, deixar explícito que o contrato foi **aceito/assinado** mesmo quando ele já está encerrado, e garantir boa responsividade no mobile.

## O que muda em `src/pages/MeusContratos.tsx`

### 1. Mostrar status duplo nos contratos de Parceiro encerrados

Hoje, contratos com `status = CLOSED` mostram apenas o badge cinza "Encerrado", o que dá a impressão de que o contrato não foi assinado. Vamos:

- Manter o badge de status atual (Ativo / Encerrado / Pendente / Inadimplente) no canto superior direito.
- Adicionar **sempre** um segundo badge verde "Assinado" ao lado, deixando claro que o contrato foi aceito.
- Reforçar o texto da data trocando "Aceito em" por **"Assinado em DD/MM/AAAA, HH:MM"** em destaque (negrito), com a linha de "Encerrado em ..." aparecendo abaixo (não mais na mesma linha) para não competir visualmente.

### 2. Melhorar responsividade mobile

Ajustes apenas de layout (sem mexer em lógica):

- Cabeçalho dos cards: trocar `flex-wrap` por `flex-col sm:flex-row` para que o título e os badges não fiquem espremidos em telas pequenas.
- Rodapé dos cards (data + botão "Ver contrato"): empilhar em mobile (`flex-col items-start sm:flex-row sm:items-center sm:justify-between`) e fazer o botão ocupar `w-full sm:w-auto`.
- Título "Meus Contratos": reduzir para `text-2xl sm:text-3xl` e o ícone para `h-6 w-6 sm:h-7 sm:w-7`.
- Container principal: garantir `px-4 sm:px-6` e remover qualquer overflow horizontal.
- Aplicar o mesmo tratamento ao card do "Contrato do Apostador" para consistência.

### 3. Verificação

- Testar visualmente em viewport mobile (375px) e desktop, conferindo o caso da Sabriny (contrato Diamond encerrado): deve aparecer claramente "Assinado em 12/05/2026, 08:58" + badge "Assinado" + badge "Encerrado".

## Fora do escopo

- Nenhuma mudança em hooks, banco, dialogs, autenticação ou outras telas.
- Sem alteração de textos legais ou fluxo de aceite.
