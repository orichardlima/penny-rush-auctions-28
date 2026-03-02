
Objetivo: corrigir o bug sem alterar UI/fluxos não relacionados, para que leilões não apareçam como “Finalizado” antes da hora e iniciem automaticamente no futuro.

1) Diagnóstico confirmado
- O banco está com leilões `status = waiting` cujo `starts_at` já passou (ex.: Motorola e Mi Band), sem lances e sem `finished_at`.
- O frontend hoje converte para `finished` quando `starts_at` já passou e `status` não é `active`. Isso força exibição errada de “Finalizado”.
- A ativação atual no cliente (`useAuctionTimer`) tenta dar `PATCH status=active`, mas com RLS (admin-only update) isso vira no-op para usuário comum/anon; por isso os leilões ficam presos em `waiting`.
- O cron atual (`bot_protection_loop`) processa apenas leilões `active`, então não ativa os `waiting` atrasados.

2) Plano de implementação
- Backend (correção estrutural):
  - Atualizar a função `public.bot_protection_loop()` para, no início de cada execução (a cada minuto), ativar leilões vencidos no agendamento:
    - `status: waiting -> active`
    - reset de `time_left = 15`
    - `last_bid_at = now()` para evitar comportamento de timer/bot incorreto na largada.
  - Incluir no mesmo migration um ajuste pontual para ativar imediatamente os leilões já atrasados hoje.
- Frontend (correção de exibição):
  - Ajustar `transformAuctionData` em:
    - `src/contexts/AuctionRealtimeContext.tsx`
    - `src/hooks/useAuctionData.ts`
  - Regra nova: só mostrar `finished` quando `auction.status === 'finished'` no banco. Nunca inferir “finalizado” só por horário.
- Hook de timer no cliente:
  - Em `src/hooks/useAuctionTimer.ts`, remover a responsabilidade de alterar `status` no banco (não depender mais de update client-side com RLS).
  - Manter apenas sincronização/refresh periódico da listagem.

3) Validação (fim-a-fim)
- Banco:
  - Confirmar que não restam `waiting` com `starts_at <= now()` após a correção.
  - Confirmar transição automática para `active` sem intervenção manual.
- Frontend:
  - Antes do início: card “Aguardando”.
  - Após o início: card “Ativo” (não “Finalizado”).
  - “Finalizado” apenas quando status realmente for finalizado no banco.
- Rede:
  - Confirmar que o cliente não tenta mais `PATCH /auctions status=active` em loop.

4) Detalhes técnicos (seu time)
- Causa raiz principal: regra de status no frontend estava “derivando” `finished` indevidamente.
- Causa raiz secundária: ativação dependia de update no cliente, incompatível com RLS de update admin-only.
- Correção segura: tornar ativação 100% server-side (cron/função), e frontend apenas refletir estado real do banco.

5) Impacto esperado
- Elimina o falso “LEILÃO FINALIZADO” em leilões sem lance.
- Restaura início automático consistente para todos os usuários.
- Mantém comportamentos existentes de leilão ativo/finalizado sem mudanças de UI fora do escopo.
