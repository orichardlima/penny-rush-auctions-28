

# Simplificar o processo manual de PIX para o Admin

## Problema atual

Quando o admin precisa fazer um PIX manualmente, ele tem que:
1. Olhar a chave PIX na tabela
2. Copiar manualmente (selecionando texto)
3. Ir ao app do banco e digitar/colar os dados
4. Voltar ao sistema e clicar "Enviar PIX" para marcar como pago

Nao ha facilidade para copiar os dados rapidamente.

## Solucao proposta

Adicionar dois recursos na tabela de "Solicitacoes de Saque":

### 1. Botao "Copiar PIX" ao lado da chave PIX

Na coluna PIX da tabela, adicionar um pequeno icone de copiar que, ao ser clicado, copia a chave PIX para a area de transferencia com feedback visual (toast "Chave PIX copiada!").

### 2. Dialog de confirmacao antes de marcar como Pago

Ao clicar em "Marcar como Pago" (renomear de "Enviar PIX"), abrir um dialog com:
- Dados do parceiro (nome, email)
- Valor formatado em destaque
- Chave PIX com botao de copiar
- Tipo da chave (CPF, CNPJ, email, etc.)
- Nome do titular (se disponivel)
- Botao "Copiar Todos os Dados" que copia um texto formatado: `PIX: 05311193514 (Cpf) | Valor: R$ 20,00 | Nome: Richard Lima`
- Checkbox ou botao "Ja fiz o PIX - Confirmar Pagamento"

Isso evita que o admin marque como pago acidentalmente sem ter feito a transferencia.

## Mudancas tecnicas

### Arquivo: `src/components/Admin/AdminPartnerManagement.tsx`

**Coluna PIX (linha ~1238-1242):**
- Adicionar botao com icone `Copy` do lucide-react ao lado da chave PIX
- Ao clicar, usa `navigator.clipboard.writeText()` e exibe toast

**Botao "Enviar PIX" (linhas ~1260-1272):**
- Renomear para "Marcar como Pago"
- Em vez de chamar `markWithdrawalAsPaid` diretamente, abrir um novo Dialog de confirmacao
- O dialog exibe todos os dados PIX com botoes de copiar
- Somente ao clicar "Confirmar Pagamento" no dialog e que chama `markWithdrawalAsPaid`

### Nenhum outro arquivo sera alterado
- A Edge Function permanece igual (ja faz apenas a marcacao no banco)
- O hook `useAdminPartners.ts` permanece igual
- Nenhuma outra tela ou componente sera modificado

