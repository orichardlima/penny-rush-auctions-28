

## Correção do texto do modelo de comissão

### Problema
O texto exibido nas configurações do programa de afiliados diz:
> "O afiliado ganha uma porcentagem do valor de **cada compra** realizada por seus indicados"

Mas a regra real do sistema é: comissão apenas na **primeira compra** do indicado.

### Solução
Corrigir o texto no componente que renderiza as configurações do programa de afiliados para refletir a regra real:
> "O afiliado ganha uma porcentagem do valor da **primeira compra** realizada por seus indicados"

### Arquivo alvo
- `src/components/AdminAffiliateManagement.tsx` (ou onde estiver o texto do modelo de comissão)

### Impacto
- Apenas correção de texto descritivo
- Nenhuma alteração de lógica, funcionalidade ou fluxo

