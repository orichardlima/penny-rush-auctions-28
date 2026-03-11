## Corrigir texto do banner Demo

O texto atual diz que "bônus de indicação estão desativados", o que contradiz a regra de negócio: a conta demo **recebe** bônus e pontos da rede abaixo dela.

### Correção

`**src/components/Partner/PartnerDashboard.tsx**` (linha 560-562): Alterar o texto para refletir as regras corretas:

> "Esta é uma conta de posicionamento. Seu contrato **não gera** repasses semanais pela plataforma e **não propaga** pontos ou bônus para quem indicou você. Porém, você recebe normalmente bônus de indicação e pontos binários da sua rede."

Uma única alteração de texto — nenhuma lógica modificada.