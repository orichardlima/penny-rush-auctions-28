
# Sistema de Configuracao do Banner de Lancamento pelo Admin

## Resumo

Transformar o banner de lancamento estatico em um componente dinamico controlado pelo painel administrativo. O admin podera ligar/desligar, editar textos, configurar links dos botoes e definir data de expiracao automatica.

---

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE DADOS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐      ┌──────────────────┐      ┌───────────────────┐     │
│   │   ADMIN     │ ──── │  SystemSettings  │ ──── │  system_settings  │     │
│   │   PANEL     │      │    Component     │      │     (Supabase)    │     │
│   └─────────────┘      └──────────────────┘      └───────────────────┘     │
│                                                            │                │
│                                                            ▼                │
│   ┌─────────────┐      ┌──────────────────┐      ┌───────────────────┐     │
│   │   USUARIO   │ ◄─── │   LaunchBanner   │ ◄─── │ useLaunchBanner   │     │
│   │    (Home)   │      │    Component     │      │      (Hook)       │     │
│   └─────────────┘      └──────────────────┘      └───────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/migrations/` | Criar | Adicionar configuracoes do banner na tabela system_settings |
| `src/hooks/useLaunchBanner.ts` | Criar | Hook para buscar e gerenciar configuracoes do banner |
| `src/components/LaunchBanner.tsx` | Modificar | Usar hook e exibir conteudo dinamico |
| `src/components/SystemSettings.tsx` | Modificar | Adicionar secao de configuracao do banner |

---

## Novas Configuracoes no Banco de Dados

As seguintes entradas serao adicionadas na tabela `system_settings`:

| setting_key | setting_type | setting_value (padrao) | description |
|-------------|--------------|------------------------|-------------|
| `launch_banner_enabled` | boolean | `true` | Ativar/desativar banner de lancamento |
| `launch_banner_title` | string | `LANCAMENTO OFICIAL!` | Titulo principal do banner |
| `launch_banner_subtitle` | string | `A plataforma Show de Lances esta no ar!` | Subtitulo do banner |
| `launch_banner_highlight` | string | `Cada lance custa apenas R$ 1!` | Texto de destaque (desktop) |
| `launch_banner_cta1_text` | string | `Ver Leiloes` | Texto do botao primario |
| `launch_banner_cta1_link` | string | `/#leiloes` | Link do botao primario |
| `launch_banner_cta2_text` | string | `Comprar Lances` | Texto do botao secundario |
| `launch_banner_cta2_link` | string | `/pacotes` | Link do botao secundario |
| `launch_banner_mobile_cta_text` | string | `Participar` | Texto do botao mobile |
| `launch_banner_expires_at` | string | (vazio) | Data/hora de expiracao automatica (ISO) |

---

## Hook useLaunchBanner

```text
┌─────────────────────────────────────────────────────────────────┐
│                      useLaunchBanner                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Retorna:                                                       │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │ - isVisible: boolean (considera enabled + expires_at)     │ │
│   │ - isLoading: boolean                                      │ │
│   │ - title: string                                           │ │
│   │ - subtitle: string                                        │ │
│   │ - highlight: string                                       │ │
│   │ - cta1: { text, link }                                    │ │
│   │ - cta2: { text, link }                                    │ │
│   │ - mobileCta: { text, link }                               │ │
│   │ - expiresAt: Date | null                                  │ │
│   └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│   Logica:                                                        │
│   1. Buscar configuracoes da system_settings                     │
│   2. Verificar se banner esta habilitado                         │
│   3. Verificar se nao expirou (expires_at > now)                 │
│   4. Verificar localStorage (usuario ja fechou?)                 │
│   5. Retornar dados formatados                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Secao no Painel Admin (SystemSettings.tsx)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎉  Banner de Lancamento                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Switch] Ativar banner de lancamento                                │   │
│  │  O banner sera exibido no topo da pagina inicial                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Titulo Principal                     Subtitulo                             │
│  ┌─────────────────────────┐         ┌─────────────────────────┐           │
│  │ LANCAMENTO OFICIAL!     │         │ A plataforma Show de... │           │
│  └─────────────────────────┘         └─────────────────────────┘           │
│                                                                              │
│  Texto de Destaque (Desktop)                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Cada lance custa apenas R$ 1!                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Botao Primario                       Botao Secundario                      │
│  ┌─────────────────────────┐         ┌─────────────────────────┐           │
│  │ Texto: Ver Leiloes      │         │ Texto: Comprar Lances   │           │
│  │ Link: /#leiloes         │         │ Link: /pacotes          │           │
│  └─────────────────────────┘         └─────────────────────────┘           │
│                                                                              │
│  Botao Mobile                                                               │
│  ┌─────────────────────────┐                                               │
│  │ Texto: Participar       │                                               │
│  └─────────────────────────┘                                               │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Expiracao Automatica                                                       │
│  ┌────────────────────────────┐   Tempo restante: 7d 12h 30min             │
│  │ 2026-02-15T23:59           │                                            │
│  └────────────────────────────┘                                            │
│  Deixe vazio para banner sem prazo definido                                │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Preview do Banner:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🎉 LANCAMENTO OFICIAL! A plataforma Show de Lances esta no ar!     │   │
│  │                [Ver Leiloes] [Comprar Lances]              [X]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                                           [ 💾 Salvar Configuracoes ]       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Tecnicos

### 1. Migracao SQL

Inserir 10 novas configuracoes na tabela `system_settings` usando INSERT:
- Todas as configuracoes terao valores padrao funcionais
- O tipo `string` sera usado para textos e links
- O tipo `boolean` para o toggle de ativacao
- A data de expiracao sera armazenada como string ISO

### 2. Hook useLaunchBanner

- Usar `useQuery` do TanStack Query para cache e revalidacao
- Verificar expiracao antes de retornar `isVisible = true`
- Manter compatibilidade com localStorage para preferencia do usuario
- Stale time de 60 segundos para nao sobrecarregar requisicoes

### 3. Modificacao do LaunchBanner

- Substituir textos hardcoded pelos valores do hook
- Exibir skeleton/loading enquanto carrega configuracoes
- Manter toda a logica visual e animacoes existentes
- Adicionar verificacao de expiracao automatica

### 4. Secao Admin

- Seguir o padrao visual das outras secoes do SystemSettings
- Usar gradiente roxo/rosa para combinar com tema de lancamento
- Incluir preview ao vivo do banner com os textos configurados
- Calcular e exibir tempo restante ate expiracao

---

## Fluxo de Implementacao

1. Criar migracao SQL para adicionar configuracoes do banner
2. Criar hook `useLaunchBanner.ts` para buscar e processar dados
3. Atualizar `LaunchBanner.tsx` para usar o hook
4. Adicionar secao de configuracao no `SystemSettings.tsx`
5. Testar funcionamento completo (toggle, edicao, expiracao)

---

## Consideracoes de Seguranca

- As configuracoes ficam na tabela `system_settings` que ja possui RLS adequado
- Apenas admins podem editar via painel (verificado pelo componente AdminDashboard)
- Usuarios comuns so podem visualizar (SELECT) - politica ja existente

---

## Beneficios

- Admin controla banner sem precisar de codigo
- Pode criar campanhas temporarias com data de fim automatico
- Pode personalizar textos para diferentes promocoes
- Pode desativar rapidamente se necessario
- Preview em tempo real antes de salvar
