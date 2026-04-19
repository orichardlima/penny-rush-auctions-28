

O usuário pergunta como processar os saques emergenciais que foram criados. Preciso explicar o fluxo, não implementar nada novo. Vou verificar rapidamente o componente de saques admin para confirmar o fluxo.

Pelo conhecimento que já tenho do contexto:
- O botão "Saque Emergencial" cria um registro com `status = 'APPROVED'` direto (pulando PENDING)
- Para executar o PIX, o admin usa o botão "Pagar" normal na lista de saques
- Esse botão chama `process-partner-withdrawal` (parceiros) ou equivalente para afiliados
- A função usa o router VeoPag/MagenPay para enviar o PIX

Não há plano de implementação aqui — é uma pergunta de uso. Vou responder diretamente sem `<lov-plan>` já que é Q&A puro.

Pelo prompt: "Skip for research". Isso é uma pergunta operacional, não implementação. Vou responder direto.

