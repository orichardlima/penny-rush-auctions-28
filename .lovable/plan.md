# Modo de Manutenção controlado pelo Admin

## O que será feito

Uma opção no painel do administrador para colocar todo o site em **modo de manutenção**: visitantes veem uma tela "Site em manutenção", enquanto o admin continua acessando normalmente. O estado e a mensagem ficam nas configurações do sistema (mesma tela onde já são configurados banner, promoções e saques).

## Como funciona

- **Chave nova em `system_settings`:**
  - `site_maintenance_enabled` (boolean, default `false`) — liga/desliga a manutenção.
  - `site_maintenance_message` (texto) — mensagem exibida na tela, editável pelo admin. Default: "Estamos em manutenção para melhorar sua experiência. Voltamos em breve!"

- **Acesso:**
  - Usuários comuns e visitantes veem uma tela full-screen de manutenção em **qualquer rota** do site (com o logo da plataforma e a mensagem configurada).
  - **Admins** (`is_admin_user`) continuam com acesso normal ao site inteiro, incluindo o painel ADM — o site funciona para eles como se nada tivesse mudado.
  - Leilões, bots, crons e todas as automações do banco **continuam rodando** — a manutenção é apenas visual/renomeia o acesso, não desliga processos.

- **Painel do admin:** novo card "Modo de Manutenção" na aba **Configurações** (`SystemSettings`), com switch de ligar/desligar e campo de texto para a mensagem. Já segue o padrão dos demais cards da tela.

## Detalhes técnicos

1. **Migration (Supabase):**
   - Inserir as duas chaves em `system_settings`.
   - Criar RPC `get_site_maintenance_status()` (SECURITY DEFINER) que retorna `{ enabled, message }` e conceder `EXECUTE` a `anon` e `authenticated`. Necessário porque `system_settings` só permite leitura a usuários autenticados — e a tela de manutenção deve aparecer para **visitantes sem login**.

2. **Frontend:**
   - Novo hook `useSiteMaintenance.ts` (react-query): chama a RPC com `refetchInterval` de ~60s, para a manutenção entrar em vigor em até 1 minuto em todo o site.
   - Novo componente `SiteMaintenanceGate.tsx`: dentro do `AppContent`, se ativo e o usuário não for admin, renderiza a tela de manutenção no lugar das rotas (sem mexer nas rotas existentes).
   - Verificação de admin reutiliza o RPC `is_admin_user` já existente.
   - A tela de manutenção usa os tokens semânticos do tema (dark, como o restante do site).
   - Título/descrição da página ajustados via Helmet quando em manutenção.

## Escopo respeitado

Nenhuma interface, fluxo ou regra existente é alterada — só é **adicionado** o modo de manutenção. Sem a flag ligada, o site fica exatamente como está hoje.

## Observações / limitações

- Como o site é um aplicativo cliente-side, o bloqueio é no nível da interface: quem já estiver com uma página aberta pode continuar vendo a última tela até recarregar (ou até 1 min). Se um dia precisar de bloqueio total (inclusive APIs), dá para evoluir para verificação nas Edge Functions — não incluído agora para manter o escopo simples.
