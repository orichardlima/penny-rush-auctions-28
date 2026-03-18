

# Bug: Plano pré-selecionado abre contrato automaticamente

## Causa

O `useEffect` nas linhas 173-189 de `PartnerDashboard.tsx` detecta `preselectedPlanId` na URL (`?plan=<id>`) e automaticamente abre o dialog de termos do contrato para aquele plano, sem dar ao usuário a chance de escolher outro.

O fluxo atual:
1. Usuário clica "Participar deste plano" na landing page (ex: Pro)
2. URL fica `/minha-parceria?plan=<pro-id>`
3. `useEffect` detecta o param e abre imediatamente o dialog de contrato do Pro
4. Usuário não tem chance de mudar de ideia

## Correção

Remover o `useEffect` de auto-abertura. O `preselectedPlanId` deve ser usado apenas para **destacar visualmente** o plano sugerido (scroll, highlight), mas o usuário deve clicar manualmente em "Participar deste plano" para abrir o contrato.

### Mudanças em `src/components/Partner/PartnerDashboard.tsx`:

1. **Remover** o `useEffect` das linhas 173-189 que auto-abre o dialog
2. **Adicionar** scroll automático e destaque visual no plano pré-selecionado (opcional, melhoria de UX)
3. O `PartnerPlanCard` do plano pré-selecionado pode receber uma prop `highlighted` para se destacar

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/Partner/PartnerDashboard.tsx` | Remover useEffect de auto-abertura; adicionar highlight no plano pré-selecionado |
| `src/components/Partner/PartnerPlanCard.tsx` | Adicionar prop `highlighted` para destaque visual (borda colorida) |

