// Hook intencionalmente no-op.
//
// A proteção/sincronização de leilões é 100% executada server-side por dois
// cron jobs nativos do Supabase (a cada 30s):
//   - bot-protection-loop-00 / bot-protection-loop-30
//   - execute-overdue-bot-bids-00 / execute-overdue-bot-bids-30
//
// A chamada que existia aqui (a cada 15s, por cliente conectado) duplicava
// esse trabalho e era a principal fonte de sobrecarga / timeouts 504 na edge
// function `sync-timers-and-protection`. Foi removida para eliminar a pressão
// no banco. A export é mantida para não quebrar imports existentes.
export const useRealTimeProtection = () => {
  // no-op
};
