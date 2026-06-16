## Objetivo

Permitir que qualquer usuário (apostador) e parceiro revisitem na tela os contratos que aceitaram, com data/hora do aceite e dados do plano (no caso do parceiro). Apenas visualização — sem PDF/download.

## O que será criado

### 1. Nova página `/meus-contratos`
Rota acessível a qualquer usuário autenticado. Lista todos os contratos aceitos pelo usuário, ordenados por data (mais recente primeiro):

- **Contrato do Apostador** (sempre presente após cadastro)
  - Data/hora do aceite
  - Versão dos termos aceita
  - Botão "Ver contrato" → abre o mesmo conteúdo de `BettorContractTermsDialog` em modo somente-leitura (sem botões de aceite)

- **Contrato(s) de Participação de Parceiro** (um por `partner_contracts` do usuário)
  - Plano, valor, cotas, data do aceite, status (ativo/encerrado/inadimplente)
  - Botão "Ver contrato" → abre `PartnerContractTermsDialog` em modo somente-leitura, já preenchido com o plano daquele contrato

### 2. Pontos de acesso (2 entradas, conforme pedido)
- **Em `MinhaParceria`**: nova aba/seção "Contratos" no topo da página, listando os contratos de parceiro do usuário + link "Ver contrato do apostador".
- **No menu do usuário** (dropdown do avatar no `Header`): novo item **"Meus contratos"** → navega para `/meus-contratos`. Visível para todo usuário autenticado.

### 3. Registro do aceite do apostador
Hoje o aceite do contrato do apostador no `Auth.tsx` não é persistido com data/versão. Para conseguir mostrar "aceito em DD/MM/AAAA":
- Adicionar duas colunas em `profiles`: `bettor_contract_accepted_at timestamptz` e `bettor_contract_version text`.
- Preencher no momento do signup (após aceite no dialog).
- Backfill: para usuários antigos sem registro, exibir "Aceito no cadastro" usando `profiles.created_at` como fallback.

### 4. Modo somente-leitura dos diálogos
Adicionar prop opcional `readOnly?: boolean` em `BettorContractTermsDialog` e `PartnerContractTermsDialog`:
- Esconde checkboxes de aceite e botões "Aceitar/Recusar".
- Mostra apenas botão "Fechar".
- Exibe banner no topo: "Contrato aceito em DD/MM/AAAA às HH:MM".

Nenhuma mudança no fluxo de aceite atual (cadastro / adesão de plano).

## Detalhes técnicos

**Arquivos novos**
- `src/pages/MeusContratos.tsx` — página com listagem.
- `src/components/Contratos/ContratoCard.tsx` — card por contrato.
- `src/hooks/useMeusContratos.ts` — busca `profiles` (bettor) + `partner_contracts` do usuário logado.

**Arquivos alterados**
- `src/App.tsx` — registra rota `/meus-contratos`.
- `src/components/Header.tsx` — item "Meus contratos" no menu do usuário.
- `src/pages/MinhaParceria.tsx` — seção/aba "Contratos".
- `src/components/BettorContractTermsDialog.tsx` — prop `readOnly` + banner.
- `src/components/Partner/PartnerContractTermsDialog.tsx` — prop `readOnly` + banner.
- `src/pages/Auth.tsx` — gravar `bettor_contract_accepted_at` / `bettor_contract_version` no signup.

**Migração (schema)**
- `ALTER TABLE public.profiles ADD COLUMN bettor_contract_accepted_at timestamptz, ADD COLUMN bettor_contract_version text;`
- RLS já cobre `profiles` (usuário lê o próprio); nenhuma policy nova.
- `partner_contracts` já tem policy de leitura própria — sem mudança.

## Fora de escopo
- Geração/download de PDF.
- Assinatura digital com hash.
- Versionamento histórico do texto do contrato (mantemos apenas a versão string; o texto exibido é sempre o atual do componente — se mudar no futuro, decidiremos como versionar).
