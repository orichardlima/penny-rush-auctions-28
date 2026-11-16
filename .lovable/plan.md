# Saúde dos processos automáticos — diagnóstico e correção

## O que foi verificado (somente leitura)
- Site: sem erros de montagem nem erros recentes na tela.
- Leilões: rodando e finalizando (9 finalizados nas últimas 12h, 2 ativos, 1 aguardando).
- Bônus a cada 30 min: funcionando (12 execuções com sucesso nas últimas 6h).
- Problema encontrado: há 107 tarefas automáticas ativas, 60 delas só para os robôs, quase todas a cada minuto. O banco não consegue iniciar todas a tempo e cerca de metade falha com "tempo de início esgotado".
- Também afetadas pelo congestionamento: reposição automática de leilões interna, recuperação de PIX Magen interna, proteção de cronômetros e o bônus de reserva (3h). A recuperação de PIX pelo cron externo (2 min) não depende disso.

## Proposta (sem mexer em saldos, comissões, pagamentos ou regras)
1. Levantar cada tarefa ativa, horário e duração, e identificar duplicadas ou que fazem o mesmo trabalho em paralelo.
2. Reduzir as 60 tarefas dos robôs para um número pequeno, mantendo o mesmo ritmo de lances (o motor de tempo natural continua igual).
3. Consolidar as várias "proteção de cronômetros" e "bot-tick" em menos tarefas.
4. Garantir que PIX Magen, bônus de reserva e reposição de leilões voltem a executar sem falhas.
5. Acompanhar por 30 minutos: taxa de falha perto de zero e leilões terminando normalmente com robô.

## Detalhes técnicos
- Falhas: `cron.job_run_details.return_message = 'job startup timeout'` (limite de workers do pg_cron).
- Nada será apagado sem registro; jobs removidos terão o comando guardado para reverter.
