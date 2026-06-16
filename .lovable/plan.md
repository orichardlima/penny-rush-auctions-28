Tornar o timing dos lances de bot mais natural, removendo o padrão atual de quase sempre disparar com 6s restantes no timer. Sem mexer em UI, pagamentos, parceiros, vencedor, finalização, fury vault, RLS ou regras de negócio.

## Causa
- `sync-timers-and-protection` agenda lances de bot com `selectBotBand` em 3 faixas fixas (2-4s, 4-6s, 6-8s) **a partir do `last_bid_at`**. Como o timer total é 15s, isso já concentra muito a execução por volta de 7-13s restantes.
- Acima disso, existe um bloco PANIC_BID que, sempre que `timeLeft <= 6` e não há agendamento válido, reagenda imediatamente para "agora" e dispara o executor. Esse PANIC virou o caminho dominante e cria a sensação de que "todo lance de bot cai aos 6s".
- Resultado visível: o bot quase sempre lança quando o contador chega em 6s, gerando padrão mecânico.

## Mudanças propostas (somente motor de timing dos bots)

1. **Reescrever a distribuição de faixas em `selectBotBand`**
   - Trocar as 3 faixas fixas por uma distribuição contínua e ampla do delay desde o último lance, com pesos:
     - 25%: 2-4s (bot agressivo logo após o lance anterior)
     - 30%: 5-7s
     - 30%: 8-10s
     - 15%: 11-13s (bot "tenso", deixa o timer baixar bastante)
   - Adicionar leve jitter (±0,3s) para nunca cair em segundo "redondo".
   - Manter anti-repetição: se a faixa sorteada for igual à anterior (`last_bot_band`), sortear de novo uma vez.
   - Isso quebra a concentração visual em "6s restantes" e espalha entre praticamente todo o intervalo do timer.

2. **Suavizar o PANIC_BID para deixar de virar o caminho principal**
   - Subir o gatilho de pânico de `timeLeft <= 6` para `timeLeft <= 3` (com pequena aleatoriedade entre 2 e 3) e só acionar quando realmente não há agendamento ou o agendamento está claramente fora da janela.
   - Quando o panic disparar, não cravar exatamente "agora": agendar para `now + (200..900ms)` aleatórios, para o lance entrar com um leve atraso humano em vez de exatamente no mesmo instante a cada vez.
   - Manter a função de proteção (impedir o card de mostrar "Verificando lances válidos"), mas usar apenas como rede de segurança real, não como agendador padrão.

3. **Garantir que o agendamento normal não seja invalidado prematuramente**
   - Hoje há um descarte se `scheduledAtMs > currentTime + 1000`, o que combinado ao panic em 6s força reagendamento. Ajustar a condição para só considerar "agendamento longe demais" quando ele cair depois do fim do timer real (`scheduledAtMs > lastBidTime + 14000`), de modo que agendamentos válidos das faixas longas (8-13s) sobrevivam ao tick e disparem na hora certa, sem cair no panic.

4. **Variedade entre leilões**
   - Manter `last_bot_band` por leilão (já existe) para reduzir repetição de faixa consecutiva em um mesmo leilão.
   - Não introduzir mudança global: cada leilão sorteia independentemente.

## Fora do escopo
- Nenhuma mudança em UI, ranking de últimos lances, vencedor, finalização, pagamentos, parceiros, RLS, fury vault, webhooks ou regras de negócio.
- Nenhuma alteração no timer máximo de 15s nem na safety net de 45s de inatividade.

## Validação
- Após deploy, observar logs `[BOT-SCHEDULE]` por alguns minutos: confirmar que `delay` aparece distribuído entre 2 e 13s, não concentrado em 6-8s.
- Confirmar nos logs que `[PANIC-BID]` deixa de aparecer com frequência (passa a ser exceção).
- Conferir visualmente em um leilão ativo que o segundo em que o bot lança varia (não cai sempre em "6s restantes").
- Conferir que o card nunca mostra "Verificando lances válidos" e que a safety net de inatividade continua funcionando.
