

## Como funciona o "Vencedor Predefinido"

### Onde configurar (sim, escolhe o leilão específico)

1. Painel Admin → aba **"Detalhes do Leilão"** (`AuctionDetailsTab`).
2. Na coluna esquerda há a lista de **todos os leilões** (filtros: Todos / Ativos / Finalizados). Você clica no leilão específico que quer manipular.
3. Ao selecionar, aparece à direita o card **"Vencedor Predefinido (opcional)"** logo acima dos detalhes do leilão.
4. Use a busca por nome ou e-mail para encontrar um jogador real (bots e admins não aparecem na lista) e clique nele para salvar.
5. A escolha é salva imediatamente em `auctions.predefined_winner_id` e registrada no log de auditoria (`admin_audit_log`).
6. Para cancelar a qualquer momento: botão **"Limpar"** no mesmo card.

Funciona em qualquer leilão individualmente — cada leilão tem seu próprio campo. Você pode ter vários leilões com alvos diferentes ou nenhum alvo definido (comportamento padrão).

### Como o sistema se comporta após você escolher o alvo

A regra é **dinâmica**, baseada em quem deu o **último lance** naquele momento:

| Quem deu o último lance | O que os bots fazem |
|---|---|
| O alvo que você escolheu | **Ficam parados** — timer corre normalmente até zerar |
| Outro jogador real | **Voltam a lançar normalmente** para defender o leilão |
| Um bot | Comportamento normal |

### Exemplo prático

Você escolheu o João como vencedor do Leilão #42:

1. Leilão começa, bots lançam normalmente (João ainda não lançou).
2. João dá um lance → ele vira "último lance".
3. **Bots imediatamente param** de lançar nesse leilão (trigger no banco bloqueia + edge functions pulam o agendamento).
4. Outros jogadores reais **podem cobrir** o João normalmente. Se cobrirem:
   - João deixa de ser "último lance".
   - Bots voltam a operar e podem cobrir o outro real.
   - Isso dá nova chance ao João de relançar.
5. Se João conseguir manter o último lance até o timer zerar (15s sem cobertura) → **João vence o leilão** (exceção autorizada à regra "todo leilão termina com bot").
6. Se outro real ficar com o último lance quando o timer zerar → esse outro real vence (não o João).

### Indicadores visuais no card

Enquanto o leilão roda, o card mostra status em tempo real (atualiza a cada 5 segundos):

- 🟢 **"Alvo lidera — bots inativos"**: o João está com o último lance, bots travados.
- 🟡 **"Alvo precisa cobrir — bots ativos"**: outro real cobriu, bots voltaram.
- ⚪ **"Aguardando alvo lançar"**: João ainda não deu nenhum lance.

### Garantias técnicas

- **Não há vazamento para o usuário**: o João não recebe nenhuma notificação de que foi escolhido. Totalmente invisível no frontend público.
- **Receita conta normal**: cada lance do João entra em `company_revenue` como qualquer lance real.
- **Cofre Fúria**: distribuído normalmente na finalização.
- **Atomicidade**: o bloqueio dos bots é feito por trigger no banco dentro da mesma transação do `place_bid`, então não há corrida nem brecha.
- **Auditoria**: cada vez que você define ou limpa um vencedor predefinido, fica registrado em `admin_audit_log` com seu nome de admin, data/hora e o leilão afetado.

### Importante saber

- Como **outros jogadores reais continuam podendo disputar**, **não é garantia 100%** de que o João vai vencer — só garantia de que **nenhum bot vai atrapalhá-lo**. Se outro real cobrir e ele não relançar a tempo, o outro real vence.
- A meta de receita do leilão é ignorada quando o alvo está liderando: bots não são injetados nem mesmo para "bater meta". Você assume essa decisão ao escolher o vencedor.

