

## Correção: Comissões não geradas para compradores reais

### O problema

A comissão do afiliado é criada na Edge Function `mercado-pago-payment` (momento da geração do PIX), e depende de um `referralCode` vindo do localStorage/cookie do navegador do comprador. Se o usuário limpou cookies, mudou de dispositivo ou o localStorage expirou, o referralCode é `null` e nenhuma comissão é gerada -- mesmo que exista um registro de referral no banco de dados ligando aquele comprador ao afiliado.

Resultado: 15 compradores reais do Paulo Mota pagaram e foram marcados como "convertidos", mas ele não recebeu comissão por nenhum deles.

### Solução

Adicionar um **fallback no banco de dados** na Edge Function `mercado-pago-payment`: quando o frontend não envia `referralCode`, a função deve consultar a tabela `affiliate_referrals` para verificar se o comprador tem um afiliado vinculado.

### Alterações

**1. `supabase/functions/mercado-pago-payment/index.ts`**

Após a linha 238 (`if (referralCode)`), adicionar um bloco `else` que:
- Busca na tabela `affiliate_referrals` se existe um registro para o `userId` com um `affiliate_id`
- Se encontrar, busca o `affiliate_code` do afiliado na tabela `affiliates`
- Usa esse código para executar a mesma lógica de criação de comissão (primeira compra ou recompra)

Isso garante que mesmo sem localStorage, se o vínculo de referral existe no banco, a comissão será gerada.

**2. Correção retroativa (SQL manual no Supabase)**

Executar query para criar as comissões faltantes dos 15 compradores que pagaram mas não geraram comissão. Isso será fornecido como instrução SQL separada para rodar no SQL Editor.

**3. Correção do campo `total_conversions` na tabela `affiliates`**

Atualizar para refletir o número real de compradores únicos convertidos (afeta todos os afiliados).

### Resultado esperado

- Novas compras sempre gerarão comissão se houver vínculo de referral no banco, independente do estado do navegador
- Paulo Mota receberá as comissões retroativas dos 15 compradores
- O card "Compradores" mostrará o número correto

