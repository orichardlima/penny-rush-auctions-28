

## Plano: Corrigir label do botão de PIX automático para refletir o gateway ativo

### Problema
O botão "Enviar PIX Automático (VeoPag)" no modal de confirmação de saque do parceiro tem o nome do provedor **hardcoded**. O backend (`withdrawal-router.ts`) já escolhe dinamicamente entre VeoPag e MagenPay com base em `system_settings.active_payment_gateway`, mas a UI sempre exibe "VeoPag", o que confunde o admin.

### Solução
Tornar o label dinâmico, lendo o gateway ativo do `system_settings`.

### Mudanças

**`src/components/Admin/AdminPartnerManagement.tsx`**
- Adicionar state `activeGateway` (default `'veopag'`)
- Em `useEffect` no mount, fazer `select` em `system_settings` filtrando `setting_key = 'active_payment_gateway'` e popular o state
- Substituir a string fixa do botão (linha 1741) por:
  ```
  `Enviar PIX Automático (${activeGateway === 'magenpay' ? 'MagenPay' : 'VeoPag'})`
  ```
- Aplicar a mesma lógica em qualquer outro botão equivalente do arquivo, se existir (ex.: saques de afiliado, regularizações)

### Fora de escopo
- Não muda nenhuma lógica de roteamento de saque
- Não altera a função `process-partner-withdrawal` nem `withdrawal-router.ts`
- Não altera UI do usuário final, apenas o painel admin

### Resultado
Quando o gateway ativo for MagenPay, o botão exibirá "Enviar PIX Automático (MagenPay)". Quando for VeoPag, exibirá "(VeoPag)". O comportamento real continua igual — só o rótulo passa a refletir a realidade.

