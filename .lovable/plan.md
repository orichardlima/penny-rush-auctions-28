

## Plano: Autonomia do Gerente para Cadastrar Influencers

### Problema Atual
Hoje, o gerente vê a aba "Meus Influencers" mas ela é **somente leitura**. Para vincular um influencer, é necessário que o **admin** faça manualmente pelo painel administrativo. A mensagem atual diz literalmente: *"Entre em contato com o administrador para vincular influencers."*

### O que será feito

**1. Gerente pode vincular influencers diretamente pelo seu dashboard**

No painel do gerente (`AffiliateDashboard.tsx`, aba "Meus Influencers"):
- Adicionar botão "Convidar Influencer" que abre um dialog
- O gerente insere o **código de afiliado** do influencer que deseja vincular
- O sistema valida: o afiliado existe? Está ativo? Já tem gerente? Não é ele mesmo?
- Se válido, cria o vínculo automaticamente na tabela `affiliate_managers` com a taxa de override padrão (definida pelo admin nas configurações)
- Remover a mensagem "Entre em contato com o administrador"

**2. Gerente pode desvincular influencers**

- Botão de desvincular na tabela de influencers do gerente
- Remove o registro de `affiliate_managers`

**3. Taxa de override padrão configurável pelo admin**

- Adicionar configuração `affiliate_default_override_rate` nas settings do admin (aba Configurações do programa de afiliados)
- Quando o gerente vincula um influencer, usa essa taxa padrão
- Admin continua podendo ajustar a taxa individual depois

**4. RLS: permitir que gerentes criem vínculos**

- Nova policy INSERT em `affiliate_managers` permitindo que um gerente (role = 'manager') insira registros onde `manager_affiliate_id` = seu próprio affiliate_id
- Nova policy DELETE para que o gerente possa desvincular seus próprios influencers

### Arquivos Impactados

- **Nova migração SQL**: policies de INSERT e DELETE para gerentes em `affiliate_managers`
- **`src/hooks/useAffiliateManager.ts`**: adicionar funções `linkInfluencerByCode` e `unlinkMyInfluencer` no hook `useAffiliateManager` (lado gerente)
- **`src/pages/AffiliateDashboard.tsx`**: adicionar botão "Convidar Influencer", dialog de convite por código, botão de desvincular na tabela
- **`src/components/AdminAffiliateManagement.tsx`**: adicionar campo "Taxa de Override Padrão" na aba Configurações (sem alterar nenhuma outra funcionalidade existente)

### Regras de Negócio

- O gerente só pode vincular afiliados com `role = 'affiliate'` e `status = 'active'`
- Um influencer só pode ter um gerente (constraint UNIQUE já existente)
- O gerente não pode se vincular a si mesmo
- A taxa de override usada é a padrão do sistema (configurada pelo admin)
- O admin mantém poder de alterar taxas individuais e desvincular

