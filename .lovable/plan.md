
# Sair da Rede do Patrocinador (Autoatendimento)

Recurso no escritório virtual que permite ao parceiro sair da rede do seu patrocinador, com cancelamento/reversão automática de bônus, desconexão binária, prazo de 7 dias para escolher novo patrocinador e retorno automático ao patrocinador original se não escolher.

## Regras de negócio (consolidadas)

1. **Elegibilidade para solicitar saída:**
   - Contrato precisa ter pelo menos **30 dias** desde a ativação (carência).
   - Contrato `status = 'ACTIVE'` e `financial_status = 'paid'` (sem inadimplência).
   - Sem solicitação de saída ativa em aberto (não pode ter duas em paralelo).
   - Deve ter patrocinador atual (não pode "sair da Empresa").

2. **Efeitos imediatos ao confirmar a saída:**
   - Cancela todos os bônus de indicação `PENDING` do antigo patrocinador originados deste parceiro (vira `CANCELLED`).
   - Reverte bônus `AVAILABLE` ainda não sacados: marca `CANCELLED` e debita do `available_balance` do antigo patrocinador (pode ficar negativo — alerta explícito).
   - Bônus já `PAID` permanecem (não é possível reverter).
   - Desconecta o parceiro da árvore binária (`partner_binary_positions`): zera `parent_contract_id`, `sponsor_contract_id`, `position`, e remove referência `left_child_id`/`right_child_id` do antigo pai.
   - Pontos binários já fechados em ciclos PAGOS não voltam; pontos em ciclos abertos são recalculados manualmente (mesma regra da realocação atual).
   - Parceiro fica **em "trânsito"** (`referred_by_user_id = NULL`, `referrer_contract_id = NULL`) por até 7 dias.
   - Notificação ao patrocinador antigo (registro em tabela de notificações + e-mail opcional).

3. **Janela de 7 dias para escolher novo patrocinador:**
   - Parceiro pode escolher **qualquer parceiro ATIVO**, exceto:
     - Sua própria downline binária (recursivo nas duas pernas).
     - O patrocinador do qual acabou de sair (bloqueio para não desfazer a ação trivialmente — pode ser reativado via admin se for engano).
   - Ao escolher: novo `referred_by_user_id` é definido. Posicionamento binário usa o mesmo fluxo de autoposicionamento existente (spillover na perna vazia do novo upline).
   - Bônus de indicação para o NOVO patrocinador começam a contar apenas a partir das próximas compras/upgrades (não retroativo).

4. **Expiração do prazo (cron diário):**
   - Se passar 7 dias sem escolha, **restaura automaticamente** o patrocinador original:
     - `referred_by_user_id` volta ao antigo.
     - Reposiciona binário na perna disponível do antigo upline (spillover).
     - **Não restaura** os bônus cancelados/revertidos (decisão consciente: evita ciclo de saída-volta para zerar saldo do upline). O patrocinador "perde" só os bônus daquele intervalo de 7 dias.

5. **Cooldown e limites anti-abuso:**
   - Após uma saída concluída (com ou sem novo patrocinador), o parceiro só pode solicitar outra saída após **90 dias**.
   - Confirmação dupla com digitação do nome completo e checkbox de ciência dos efeitos irreversíveis.

6. **Auditoria:** toda solicitação registrada em `admin_audit_log` com `action_type='PARTNER_SELF_LEAVE_NETWORK'`, incluindo IP, motivo (opcional), valores impactados.

## UX (escritório virtual do parceiro)

Nova seção em **Minha Parceria → Configurações da Rede → "Sair da rede do meu patrocinador"** (oculta para quem já está na Empresa ou ainda em carência).

Fluxo:
1. **Tela inicial:** explicação clara, mostra patrocinador atual, prazo de carência (se aplicável), cooldown (se aplicável).
2. **Prévia de impacto:** "Ao sair você cancelará R$ X em bônus pendentes e reverterá R$ Y já disponíveis para Fulano". Lista pontos binários afetados.
3. **Motivo (opcional, textarea).**
4. **Confirmação dupla:** digitar nome completo + checkbox "Entendo que esta ação é irreversível e que tenho 7 dias para escolher novo patrocinador, senão voltarei automaticamente para Fulano".
5. **Tela pós-saída (estado "em trânsito"):**
   - Banner persistente: "Você está sem patrocinador. Restam X dias para escolher um novo, senão voltará automaticamente para Fulano".
   - Campo de busca de novo patrocinador (mesmo padrão da busca admin) com filtro automático excluindo downline.
   - Botão "Confirmar novo patrocinador".

## Detalhes técnicos

### Tabelas novas
- **`partner_network_exits`**
  - `id`, `partner_contract_id`, `old_sponsor_user_id`, `old_sponsor_contract_id`, `old_binary_parent_id`, `old_binary_position`
  - `new_sponsor_user_id` (nullable, preenchido quando escolhe)
  - `status`: `IN_TRANSIT` | `COMPLETED` | `REVERTED_TIMEOUT` | `REVERTED_ADMIN`
  - `cancelled_pending_total`, `reverted_available_total`, `affected_bonus_count`
  - `reason`, `created_at`, `expires_at` (now + 7 dias), `resolved_at`, `ip_address`
  - RLS: parceiro vê os próprios; admin vê todos.

### Funções SQL (SECURITY DEFINER)
- `partner_check_leave_eligibility(p_contract_id)` → retorna `{ eligible, reason, days_since_activation, cooldown_remaining, last_exit_at }` para a UI.
- `partner_preview_leave_network(p_contract_id)` → reusa lógica do preview admin, retorna impacto financeiro e binário.
- `partner_leave_sponsor_network(p_contract_id, p_reason, p_ip)` → executa a saída (chama internamente o mesmo núcleo de `admin_transfer_partner_sponsor` mas sempre destino = órfão), cria registro em `partner_network_exits`, valida carência/cooldown/elegibilidade, audita.
- `partner_choose_new_sponsor(p_contract_id, p_new_sponsor_user_id)` → valida exit ativo + não-downline + não é o sponsor antigo, atualiza `referred_by_user_id`, chama autoposicionamento binário, marca exit como `COMPLETED`.
- `partner_search_eligible_sponsors(p_contract_id, p_term)` → busca parceiros ativos excluindo downline própria (recursivo via CTE em `partner_binary_positions`).

### Cron (pg_cron)
- Job horário `partner_network_exit_expiry` que pega `partner_network_exits` com `status='IN_TRANSIT' AND expires_at < now()` e:
  - Restaura `referred_by_user_id` para `old_sponsor_user_id`.
  - Reposiciona binário no `old_binary_parent_id` na perna disponível (ou spillover se ocupada).
  - Marca exit como `REVERTED_TIMEOUT`.
  - Notifica parceiro e patrocinador antigo.

### Reuso
- 90% da lógica de reversão de bônus e desconexão binária é reaproveitada da função `admin_transfer_partner_sponsor` já existente — extrair núcleo para função interna `_internal_disconnect_from_sponsor()` chamada por ambos os fluxos (admin e self-service).

### Frontend
- Novo componente `src/components/Partner/LeaveSponsorNetwork.tsx` (card + dialogs).
- Novo componente `src/components/Partner/ChooseNewSponsorBanner.tsx` (banner persistente quando em trânsito).
- Integrar em `PartnerDashboard.tsx` (banner no topo se em trânsito) e em uma nova aba/seção de "Configurações da rede".
- Hook `useNetworkExitStatus` para polling do estado atual.

### Notificações
- Inserir em `notifications` (tabela existente) para: parceiro (confirmação, lembrete dia 5, lembrete dia 6, reversão automática), patrocinador antigo (saída ocorreu, parceiro voltou automaticamente).

## Pontos de atenção a confirmar antes de codar
- **Notificação por e-mail** ao patrocinador antigo: enviar agora ou só notificação in-app? (custo de Resend, sensibilidade do tema)
- **Reversão de pontos binários em ciclos abertos:** manter recálculo manual (como hoje) ou tentar automatizar? Recomendo manter manual nesta primeira versão.
- **Saldo negativo do patrocinador:** permitir (como hoje no admin) ou bloquear saída se faltar saldo? Recomendo permitir + alerta.
