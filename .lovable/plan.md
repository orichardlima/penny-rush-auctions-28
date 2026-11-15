# Bônus de Equipe — diagnóstico e correção do fechamento semanal

## O que foi encontrado (somente leitura)
- **Simara Serra dos Santos Santiago (simaraserra@hotmail.com)**: nenhum lançamento de Bônus de Equipe gerado até hoje.
- Isso não é só com ela: **nenhum parceiro** tem lançamento de Bônus de Equipe no sistema.
- Até a semana de 12/10–18/10 o fechamento semanal rodava, mas todos os 53 parceiros saíam "sem volume" (não havia pontos de equipe naquelas semanas).
- A partir de 19/10 começaram a entrar pontos de equipe (19/10: 16.000 pts; 26/10: 4.650; 02/11: 9.750; 09/11: 7.050).
- **Justamente desde então o fechamento semanal está falhando**: semanas 19/10, 26/10 e 02/11 terminaram com erro "fechamento oficial não concluído", após 5–6 tentativas automáticas. Nenhum fechamento foi gravado depois de 19/10.
- A semana 12/10 também ficou travada na auditoria financeira (6 alertas altos), o que impede a etapa de carreira.

Conclusão: **o Bônus de Equipe não está sendo processado** há 3 semanas. Os pontos estão guardados; nada foi perdido, só não foi calculado.

## Plano
1. **Confirmar a causa**: o cálculo do fechamento responde "concluído", mas o registro do fechamento não fica salvo. Rodar o fechamento da semana 19/10 em modo de teste (com desfazer) para ver exatamente onde ele é descartado.
2. **Corrigir somente essa falha** na rotina de fechamento, sem mudar regras de pontos, fatores, tetos ou prazos.
3. **Revisar os 6 alertas da auditoria** da semana 12/10 e mostrar a você antes de liberar.
4. **Simular (sem gravar) os bônus** das semanas 19/10, 26/10 e 02/11, parceiro por parceiro, incluindo a Simara, e apresentar os valores para sua aprovação.
5. Só após sua aprovação: processar as semanas atrasadas uma única vez, sem duplicidade, e confirmar que o fechamento de 16/11 roda sozinho.

## Detalhes técnicos
- Erro em `expansion_orchestration_runs`: `fechamento oficial nao concluido: COMPLETED` — `expansion_run_weekly_close` retorna status COMPLETED, mas o SELECT seguinte em `expansion_close_runs` não encontra a linha (provável divergência de período/status ou gravação revertida no bloco de exceção).
- `expansion_bonus_lines` está vazia; `expansion_points_ledger` tem 39 lançamentos desde 19/10.
- Nenhuma alteração de saldo até a aprovação do passo 4.
