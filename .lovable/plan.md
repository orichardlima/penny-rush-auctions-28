

## Plano: Substituir input de data nativo por campos separados (dia/mês/ano)

### Problema
O seletor de data nativo do navegador (`<input type="date">`) obriga o usuário a navegar mês a mês para chegar ao ano de nascimento, tornando o processo lento — especialmente em dispositivos móveis.

### Solução
Substituir o `<input type="date">` por **3 campos select separados**: Dia, Mês e Ano. Isso permite que o usuário selecione diretamente o ano (ex: 1990) sem precisar clicar dezenas de vezes.

### Alteração (apenas `src/pages/Auth.tsx`)

- Remover o `<Input type="date">` do campo `birthDate` (linhas 644-653)
- Adicionar 3 `<select>` (ou `<Select>` do shadcn) lado a lado: **Dia** (1-31), **Mês** (Janeiro-Dezembro), **Ano** (ano atual - 18 até 1920)
- Criar estados internos `birthDay`, `birthMonth`, `birthYear` e compor o valor `formData.birthDate` no formato `YYYY-MM-DD` quando os 3 estiverem preenchidos
- Ajustar dinamicamente os dias disponíveis com base no mês/ano selecionado (ex: fevereiro com 28/29 dias)
- Manter validação existente e estilo visual consistente

Nenhuma outra tela ou componente será alterado.

