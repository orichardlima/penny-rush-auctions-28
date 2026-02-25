

# Redesign: Cofre Fúria integrado ao card de leilão

## Problema

O layout compacto atual do Cofre Fúria ficou confuso e minimalista demais. Ele aparece como um bloco separado e desconectado das informações do leilão. O usuário quer que as informações do cofre estejam integradas naturalmente ao card, ao lado dos dados de lances.

## Proposta — Cofre integrado na seção de dados do card

Em vez de um bloco separado, o Cofre Fúria vira uma **seção visual dentro da área de dados do card**, com título claro, valor em destaque e informações didáticas:

```text
┌───────────────────────────────────┐
│         IMAGEM 16:10              │
├───────────────────────────────────┤
│ iPhone 15 Pro                     │
│ Câmera 48MP, chip A17 Pro...      │
│                                   │
│ Preço atual:          R$ 24,65    │
│ Valor na loja:       R$ 5.999,00  │
│ Economia:               97% OFF   │
│ 🔨 2464 lances                    │
│ 🕐 Ativo há 2h 15min             │
│ Últimos: Ana, Bob, Carlos         │
│                                   │
│ ┌───────────────────────────────┐ │
│ │ 🔒 Cofre Fúria      R$12,50  │ │
│ │                               │ │
│ │ Próximo +R$:                  │ │
│ │ [████████████░░░░] 8 lances   │ │
│ │                               │ │
│ │ 👥 23 qualificados            │ │
│ │ ✓ Você está qualificado       │ │
│ │   (18/15 lances)              │ │
│ └───────────────────────────────┘ │
│                                   │
│ [      DAR LANCE (R$ 1,00)      ] │
└───────────────────────────────────┘
```

### Variação: Usuário NÃO qualificado

```text
│ ┌───────────────────────────────┐ │
│ │ 🔒 Cofre Fúria      R$12,50  │ │
│ │                               │ │
│ │ Próximo +R$:                  │ │
│ │ [████████████░░░░] 8 lances   │ │
│ │                               │ │
│ │ 👥 23 qualificados            │ │
│ │ Sua qualificação:             │ │
│ │ [██████░░░░░░░░░░] 7/15       │ │
│ └───────────────────────────────┘ │
```

### Variação: Modo Fúria

```text
│ ┌───────────────────────────────┐ │
│ │ 🔥 Cofre Fúria      R$18,30  │ │  ← borda vermelha
│ │    MODO FÚRIA ATIVO!          │ │  ← badge vermelho
│ │                               │ │
│ │ Próximo +R$:                  │ │
│ │ [████████████░░░░] 3 lances   │ │
│ │                               │ │
│ │ 👥 31 qualificados            │ │
│ │ ✓ Você está qualificado       │ │
│ └───────────────────────────────┘ │
```

### Recency countdown (substitui status de qualificação)

```text
│ │ ⏱ Lance em 12s para manter    │ │
│ │   sua qualificação!            │ │
```

### Leilão finalizado (sem mudança, já compacto)

```text
│ ┌───────────────────────────────┐ │
│ │ 🔒 Cofre Fúria      R$45,00  │ │
│ │ 🏆 Top: R$22,50              │ │
│ │ 🎁 Sorteio: R$22,50          │ │
│ └───────────────────────────────┘ │
```

## O que muda vs. layout atual

| Aspecto | Antes (compacto) | Agora (integrado) |
|---|---|---|
| Valor do cofre | Inline críptico `R$12,50 • +1 em 8` | Título claro + valor em destaque |
| Próximo incremento | `+1 em 8` (confuso) | Barra de progresso com label "Próximo +R$" |
| Qualificados | `23 qual.` (abreviado) | `👥 23 qualificados` (legível) |
| Status do usuário | `✓ Qualificado` tiny ou barra h-1 | Seção clara com label + progresso visível |
| Detalhes extras | Botão ⓘ abrindo drawer | Removido — tudo visível no card |
| Altura estimada | ~40px | ~100-110px |

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `src/components/FuryVaultDisplay.tsx` | Reescrever layout: seção card integrada com título, barra de progresso, qualificados e status do usuário. Remover Drawer/Dialog. |
| `src/components/AuctionCard.tsx` | Nenhuma mudança (já renderiza FuryVaultDisplay no lugar certo) |

## Sem Impacto Em

- `useFuryVault.ts` — nenhuma mudança
- Lógica de qualificação, realtime, recency — nenhuma
- Outros componentes, rotas ou workflows

