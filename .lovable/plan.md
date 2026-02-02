

## Plano: Automação de Repasses Semanais (Domingo 23h)

### Visão Geral

Criar uma Edge Function que será executada automaticamente todo domingo após às 23h, somando os rendimentos diários da semana (segunda→domingo) e gerando os registros de repasse para cada parceiro ativo.

---

### Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/partner-weekly-payouts/index.ts` | **Criar** - Edge Function principal |
| `supabase/config.toml` | **Modificar** - Adicionar configuração da função |

---

### Lógica da Edge Function

```
1. Calcular semana atual (segunda→domingo)
2. Verificar se é domingo após 23h (ou aceitar execução manual/forçada)
3. Buscar todos os contratos ACTIVE
4. Para cada contrato:
   a. Verificar se já existe payout para esta semana (idempotência)
   b. Buscar daily_revenue_config de segunda a domingo
   c. Aplicar Pro Rata (ignorar dias antes da criação do contrato)
   d. Somar percentuais e calcular valor do repasse
   e. Aplicar teto total se necessário
   f. Criar registro em partner_payouts
   g. Atualizar total_received do contrato
   h. Fechar contrato se atingiu o teto
5. Retornar resumo do processamento
```

---

### Segurança

- Função com `verify_jwt = false` (necessário para chamadas do cron)
- Validação interna: só processa se for domingo após 23h OU se receber `force=true` (para backfill manual pelo admin)
- Logs detalhados para auditoria

---

### Agendamento (pg_cron)

Após criar a função, você precisará executar este SQL no Supabase (SQL Editor):

```sql
SELECT cron.schedule(
  'partner-weekly-payouts',
  '5 23 * * 0',  -- Domingo às 23:05 (5 min após fechamento)
  $$
  SELECT net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/partner-weekly-payouts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

### Seção Técnica

**Estrutura da Edge Function:**

```typescript
// partner-weekly-payouts/index.ts

import { createClient } from '@supabase/supabase-js'

// Helpers para datas locais (Brasil)
const parseLocalDate = (dateStr: string): Date => { ... }
const formatLocalDate = (date: Date): string => { ... }
const getWeekStart = (date: Date): Date => { ... }  // Segunda-feira
const getWeekEnd = (date: Date): Date => { ... }    // Domingo

Deno.serve(async (req) => {
  // 1. Verificar se é domingo após 23h (ou force=true)
  // 2. Calcular weekStart/weekEnd
  // 3. Buscar contratos ativos
  // 4. Para cada contrato:
  //    - Verificar idempotência
  //    - Buscar daily_revenue_config
  //    - Aplicar Pro Rata
  //    - Calcular valor
  //    - Criar payout
  //    - Atualizar contrato
  // 5. Retornar resumo
})
```

**Idempotência:**
```typescript
// Verificar se já existe payout para esta semana
const { data: existingPayout } = await supabase
  .from('partner_payouts')
  .select('id')
  .eq('partner_contract_id', contract.id)
  .eq('period_start', weekStart)
  .single();

if (existingPayout) {
  // Já processado, pular
  continue;
}
```

---

### Testes Após Implementação

1. **Teste manual**: Chamar a função com `force=true` para processar a semana 26/01-01/02
2. **Verificar banco**: Confirmar criação dos registros em `partner_payouts`
3. **Verificar UI**: Rendimento deve aparecer no painel do parceiro
4. **Configurar cron**: Executar o SQL de agendamento

---

### Backfill da Semana 26/01-01/02

Após a função estar ativa, você poderá processar a semana pendente chamando:

```bash
curl -X POST \
  'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/partner-weekly-payouts' \
  -H 'Authorization: Bearer [anon_key]' \
  -H 'Content-Type: application/json' \
  -d '{"force": true, "weekStart": "2026-01-26"}'
```

Ou diretamente pela interface do Admin (se adicionarmos um botão para isso).

