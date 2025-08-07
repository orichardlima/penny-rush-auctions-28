# Sistema de Leilão de Centavos com Proteção de Bots

## 🤖 Sistema de Proteção Implementado

### Funcionalidades
- ✅ Proteção automática de leilões com faturamento mínimo
- ✅ Lances de bots transparentes para manter leilões ativos
- ✅ Dashboard admin para configurar proteção por leilão
- ✅ Edge Function executada automaticamente
- ✅ Logs completos de atividade dos bots
- ✅ Realtime updates para todos os componentes

### Componentes Principais

**Edge Function**: `supabase/functions/bot-protected-bid/index.ts`
- Monitora leilões protegidos
- Insere lances de bot quando necessário
- Executa automaticamente (configurar cron)

**Painel Admin**: Nova aba "Proteção"
- Configure modo proteção por leilão
- Defina meta de faturamento
- Monitore progresso em tempo real
- Visualize logs de bots

**Database**: Tabelas e triggers atualizados
- Campo `protected_mode` e `protected_target` em auctions
- Campo `is_bot` em bids
- Tabela `bot_logs` para auditoria
- Triggers automáticos para estatísticas

### Como Usar

1. **Ativar Proteção**: No painel admin, aba "Proteção"
2. **Configurar Meta**: Defina faturamento alvo (ex: R$ 500,00)
3. **Monitorar**: Sistema executa automaticamente
4. **Desativação**: Proteção desativa ao atingir meta

### Teste Manual
Use o botão "Testar Proteção" no painel admin para verificar funcionamento.

---
Sistema completo implementado com Supabase + React + TypeScript