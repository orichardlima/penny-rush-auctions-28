# Repasses semanais "não caíram" — diagnóstico e correção

## O que encontrei (dados reais)
- O repasse do woliveiraba00@gmail.com (Diamond) da semana **26/10–01/11 já foi pago: R$ 250**, mas foi lançado **na segunda 26/10 às 10:28 (Bahia)**, no início da semana, e não no domingo à noite como sempre.
- Isso aconteceu com quase todos: **53 parceiros** receberam o repasse de 26/10–01/11 adiantado em 26/10 (R$ 10.414,25). A semana anterior (19/10–25/10) também saiu antes da hora, no sábado 24/10 (55 parceiros).
- Quando a rotina automática rodou no domingo 01/11, encontrou o repasse já lançado e não pagou de novo (só 12 parceiros novos receberam).
- Resultado: o valor que o parceiro esperava "cair" nesta segunda já tinha caído na segunda passada. Nada sumiu e não há repasse faltando; o calendário ficou adiantado uma semana na percepção dele.
- O print mostra 7/7 dias confirmados: a divulgação foi reconhecida normalmente.

## Plano
1. Confirmar quem/o que disparou as execuções antecipadas de 24/10 e 26/10 (painel admin ou rotina), lendo o histórico do painel e os registros da rotina semanal.
2. Conferir se o valor adiantado de 26/10 usou o faturamento correto da semana 26/10–01/11 (que ainda nem tinha acontecido) e recalcular, só para comparação, quanto cada parceiro teria recebido no domingo. Mostrar a diferença antes de qualquer ajuste.
3. Trava na rotina: impedir gerar repasse de uma semana antes de ela terminar (domingo 23:59 Bahia), tanto pelo botão do painel quanto pela automação.
4. Te entregar uma mensagem curta para os parceiros explicando que o repasse da semana 26/10–01/11 foi antecipado para 26/10 e o próximo cai no fechamento de 08/11.

Nenhum valor será alterado nos passos 1–2 sem sua autorização. VeoPag/Magen não são tocados.
