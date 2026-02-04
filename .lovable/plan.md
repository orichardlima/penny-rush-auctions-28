
# Banner de Lançamento Oficial da Plataforma

## Resumo

Criar um banner promocional destacado no topo da página inicial anunciando a abertura oficial da plataforma Show de Lances. O banner será fixo acima do Header e terá design atrativo com animações sutis.

---

## Design do Banner

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│  🎉  LANÇAMENTO OFICIAL! A plataforma Show de Lances está no ar!  🚀           │
│                                                                                 │
│      [Ver Leilões]  [Comprar Lances]                              [X]          │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Características visuais:**
- Gradiente vibrante (primary → accent) com animação sutil de brilho
- Ícones de celebração (confetti, rocket, sparkles)
- Botões de ação para converter visitantes
- Botão de fechar que salva preferência no localStorage
- Totalmente responsivo (adaptado para mobile)

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/LaunchBanner.tsx` | Criar novo componente |
| `src/pages/Index.tsx` | Importar e renderizar acima do Header |
| `src/index.css` | Adicionar animação de shimmer/brilho |

---

## Estrutura do Componente

### LaunchBanner.tsx

```text
┌─────────────────────────────────────────────────────────────────┐
│                        LaunchBanner                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Estado: dismissed (boolean)                                   │
│   - Verificar localStorage("launch_banner_dismissed")           │
│   - Se true, não renderiza o banner                             │
│                                                                 │
│   Layout:                                                       │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │ Desktop: Faixa horizontal com texto + 2 botões + fechar   │ │
│   │ Mobile: Texto menor + 1 botão + fechar                    │ │
│   └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│   Animações:                                                    │
│   - Shimmer effect no background                                │
│   - Fade in suave ao carregar                                   │
│   - Fade out ao fechar                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Especificações Detalhadas

### Texto e CTAs

**Desktop:**
- Título: "🎉 LANÇAMENTO OFICIAL! A plataforma Show de Lances está no ar!"
- Subtítulo: "Ganhe produtos incríveis por centavos. Cada lance custa apenas R$ 1!"
- CTA 1: "Ver Leilões" → /leiloes
- CTA 2: "Comprar Lances" → /pacotes

**Mobile:**
- Título: "🎉 Lançamento Oficial!"
- Subtítulo: "Participe agora dos leilões"
- CTA único: "Participar" → /leiloes

### Estilização

| Propriedade | Valor |
|-------------|-------|
| Background | Gradiente primary → accent com overlay shimmer |
| Altura | 56px desktop / 48px mobile |
| Posição | Fixo no topo (acima do Header sticky) |
| Sombra | shadow-lg para destaque |
| Z-index | 60 (acima do Header que é 50) |

### Persistência

- Ao clicar no X, salvar `launch_banner_dismissed: true` no localStorage
- Ao carregar, verificar se já foi fechado
- Banner aparece novamente após 7 dias (opcional)

---

## Animação CSS

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.1) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 3s infinite;
}
```

---

## Fluxo de Implementação

1. Criar animação CSS de shimmer no `index.css`
2. Criar componente `LaunchBanner.tsx` com toda a lógica
3. Importar e posicionar no `Index.tsx` antes do Header
4. Testar responsividade e comportamento de fechamento
