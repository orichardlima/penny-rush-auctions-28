## Objetivo
Notificar o parceiro e o patrocinador antigo (e o novo, quando aplicável) em cada etapa do fluxo de saída da rede, via **e-mail** (Resend, já em uso) e **in-app** (nova tabela + sino no header).

## Eventos cobertos

| # | Evento | Quem recebe | Conteúdo principal |
|---|--------|-------------|--------------------|
| 1 | Saída efetivada (`partner_leave_sponsor_network`) | Parceiro | Confirmação, prazo de 7 dias, valores cancelados, data limite |
| 1b | Saída efetivada | Patrocinador antigo | Parceiro saiu, motivo (se informado), bônus pendentes cancelados, bônus disponíveis revertidos |
| 2 | Novo patrocinador escolhido (`partner_choose_new_sponsor`) | Parceiro | Confirmação, nome do novo patrocinador |
| 2b | Novo patrocinador escolhido | Novo patrocinador | Boas-vindas, novo membro entrou na sua rede |
| 2c | Novo patrocinador escolhido | Patrocinador antigo | Saída definitiva (parceiro encontrou novo patrocinador) |
| 3 | Lembrete dia 5 e dia 6 (cron) | Parceiro em trânsito | Faltam X dias para escolher, senão volta ao anterior |
| 4 | Reversão automática por expiração (`partner_process_expired_network_exits`) | Parceiro | Voltou para a rede do patrocinador anterior |
| 4b | Reversão automática | Patrocinador antigo | Parceiro voltou para sua rede |

## Mudanças no banco

### Nova tabela `notifications`
```
id, user_id, type, title, message, metadata (jsonb), 
link (text, opcional), read_at, created_at
```
- RLS: usuário lê/atualiza apenas as próprias; admin gerencia tudo
- Index em `(user_id, read_at, created_at)`
- GRANTs padrão (authenticated + service_role)

### Função helper `create_notification(...)`
SECURITY DEFINER, usada pelas RPCs e cron para inserir notificação e (opcionalmente) chamar `send-email` via `pg_net`.

### Atualizar RPCs existentes
- `partner_leave_sponsor_network`: ao final, criar 2 notificações (parceiro + ex-sponsor) + disparar 2 e-mails
- `partner_choose_new_sponsor`: 3 notificações + 3 e-mails
- `partner_process_expired_network_exits`: 2 notificações + 2 e-mails por exit revertido

### Novo job pg_cron `partner_network_exit_reminders`
- Roda 1x/dia
- Busca exits `IN_TRANSIT` cujos `expires_at` está a 1 ou 2 dias (dias 5/6 desde criação)
- Usa coluna nova `reminders_sent jsonb` em `partner_network_exits` para não duplicar lembretes
- Envia notificação + e-mail apenas uma vez por marco

### Extensão de `send-email`
Adicionar 4 novos `type` no edge function existente:
- `network_exit_partner` — confirmação ao parceiro
- `network_exit_old_sponsor` — aviso ao ex-patrocinador
- `network_exit_reminder` — lembretes dia 5/6
- `network_exit_new_sponsor` — boas-vindas ao novo
- `network_exit_reverted_partner` / `network_exit_reverted_sponsor` — reversão automática

Cada um com seu template `.tsx` em `supabase/functions/send-email/_templates/` reaproveitando o estilo dos existentes.

## Mudanças no frontend

### `src/hooks/useAppNotifications.ts` (novo)
- Hook genérico: lista notificações do usuário (`notifications` table), realtime via supabase channel, `markAsRead`, `markAllRead`, contador de não-lidas.

### `src/components/NotificationBell.tsx` (novo)
- Ícone de sino com badge de contagem
- Popover/Sheet com lista das últimas 20 notificações
- Clique marca como lida; se houver `link`, navega
- Empty state amigável

### `src/components/Header.tsx` (edit pontual)
- Adicionar `<NotificationBell />` ao lado dos controles do usuário logado, sem mexer em mais nada

## Detalhes técnicos

- E-mails disparados via `pg_net.http_post` para `supabase.functions.invoke('send-email')` — mesmo padrão já usado no projeto (anon key dinâmica, conforme memory `database-dynamic-anon-key-retrieval`)
- Falhas de e-mail **não** podem reverter a transação principal: chamadas envoltas em `BEGIN ... EXCEPTION WHEN OTHERS THEN ... END;`
- Notificação in-app é criada na mesma transação da ação (atômico). E-mail é assíncrono (`pg_net`).
- `metadata` guarda IDs (`exit_id`, `partner_user_id`, `old_sponsor_user_id`) para auditoria e deep-link.
- Templates de e-mail incluem: motivo informado (quando houver), datas (saída/expiração), valores (R$), nome dos envolvidos.

## Arquivos

**Novos**
- `supabase/migrations/<ts>_notifications_and_network_exit_alerts.sql`
- `supabase/functions/send-email/_templates/network-exit-partner.tsx`
- `supabase/functions/send-email/_templates/network-exit-old-sponsor.tsx`
- `supabase/functions/send-email/_templates/network-exit-reminder.tsx`
- `supabase/functions/send-email/_templates/network-exit-new-sponsor.tsx`
- `supabase/functions/send-email/_templates/network-exit-reverted.tsx`
- `src/hooks/useAppNotifications.ts`
- `src/components/NotificationBell.tsx`

**Editados**
- `supabase/functions/send-email/index.ts` — novos cases
- `src/components/Header.tsx` — adicionar sino (mínimo, sem refator)
- `src/integrations/supabase/types.ts` — auto-regenerado após migration

## Fora do escopo
- Preferências de notificação por usuário (mute por tipo) — fica para depois
- Push notifications (web push / mobile)
- Reescrever ou redesenhar componentes existentes não relacionados