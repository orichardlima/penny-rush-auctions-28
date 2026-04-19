

## Contexto e descoberta

Atualmente saques (PIX Out) usam **VeoPag** via `process-partner-withdrawal` (memo `magenpay-pix-out-limitation` confirma: MagenPay/VPS é só para depósitos). O usuário quer adicionar **PIX Out via VPS MagenPay** (`POST /pix/enviar` + polling em `/pix/enviar/status/{externalId}`).

Preciso verificar:
1. Como `process-partner-withdrawal` está estruturado (já vi na knowledge — usa VeoPag direto).
2. Se existe edge function equivalente para saques de afiliado.
3. Onde estão os botões de "Pagar" no admin para acionar o envio.
4. Se o roteamento por gateway (igual depósitos via `payment-router.ts`) faz sentido aqui.

