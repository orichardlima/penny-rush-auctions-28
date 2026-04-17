

O usuário aprovou Entrega 1 e disse "Siga!" — quer Entrega 2 (Escala / Fase 3). Vou propor plano conciso.

**Entrega 2 — Escala**: ranking, materiais, link individual, tracking dedicado.

Verificações rápidas:
- `ad_center_materials` já existe (para parceiros). Vou criar tabela separada `affiliate_materials` para não misturar com sistema de parceiros (regra do usuário: "Não misturar com sistema de parceiros").
- Tracking de cliques já usa `affiliate_referrals` (referred_user_id NULL = clique). Funcional, não precisa nova tabela.
- Link individual: `affiliate_code` já existe; só exibir `/?ref=CODE` na UI.

