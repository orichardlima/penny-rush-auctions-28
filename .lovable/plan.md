## Visão admin das saídas de rede (troca de patrocinador)

Hoje o fluxo de saída é self-service e automático (sem aprovação), mas não há tela para o admin visualizar/auditar as solicitações registradas em `partner_network_exits`.

### O que será criado

**1. Nova aba "Saídas de Rede" em `AdminPartnerManagement.tsx`**
- Posicionada ao lado de "Encerramentos" (`terminations`), com ícone `UserMinus`.
- Renderiza um novo componente `AdminNetworkExitsTab`.

**2. Componente `src/components/Admin/AdminNetworkExitsTab.tsx`**
Lista todas as solicitações de `partner_network_exits`, com:
- **Cards de resumo:** total, em janela aberta (PENDING_NEW_SPONSOR), concluídas com novo patrocinador, expiradas (voltaram para Empresa), revertidas.
- **Filtros:** status (todas / aguardando novo sponsor / concluída / expirada / revertida) e busca por nome do parceiro/patrocinador antigo/novo.
- **Tabela** com colunas:
  - Parceiro (nome + e-mail)
  - Patrocinador antigo
  - Novo patrocinador (ou "Empresa" se expirou)
  - Status (badge colorido)
  - Bônus PENDING cancelados (qtd + R$)
  - Bônus AVAILABLE revertidos (qtd + R$)
  - Solicitado em
  - Expira em / Resolvido em
- **Modal de detalhes** ao clicar na linha: mostra histórico completo (posição binária antiga, motivo informado, IP, lembretes enviados em `reminders_sent`).

**3. Acesso aos dados**
- Query direta em `partner_network_exits` (RLS já permite admin via `is_admin_user`).
- Nomes resolvidos via `get_public_profiles` (mesmo padrão de `AdminReferralBonusesTab`).
- Sem novas migrations, sem novos endpoints.

### Fora de escopo
- Nenhuma alteração no fluxo do parceiro, nas regras de elegibilidade, nos e-mails ou nos triggers existentes.
- Não há ação de "aprovar/rejeitar" — o fluxo continua automático; a tela é somente leitura/auditoria.
