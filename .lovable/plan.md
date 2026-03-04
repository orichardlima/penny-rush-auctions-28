

## Gerenciamento de Contratos pelo Admin

Atualmente os textos dos contratos (Apostador e Parceiro) estão fixos no código. Para permitir que o admin edite, vamos armazenar o conteúdo na tabela `system_settings` e adicionar uma seção de edição no painel de Configurações do Sistema.

### O que será feito

1. **Banco de dados** — Inserir 2 registros na `system_settings`:
   - `contract_bettor_text` (texto do contrato do apostador)
   - `contract_partner_text` (texto do contrato do parceiro)
   - Valores iniciais = texto atual hardcoded dos componentes

2. **Nova seção em `SystemSettings.tsx`** — Card "Contratos Legais" com:
   - Duas abas (Apostador / Parceiro)
   - Textarea grande para cada contrato
   - Botão "Salvar" que grava na `system_settings`
   - Dica informando que o texto suporta quebras de linha

3. **Atualizar `BettorContractTermsDialog.tsx`** — Buscar o texto de `system_settings` via `useSystemSettings`. Se existir valor no banco, exibir o texto dinâmico; senão, manter o texto hardcoded como fallback.

4. **Atualizar `PartnerContractTermsDialog.tsx`** — Mesma lógica: buscar `contract_partner_text` do banco, com fallback para o texto atual.

### Detalhes técnicos

- Os textos serão armazenados como string simples com quebras de linha (`\n`), renderizados com `whitespace-pre-wrap`
- Sem necessidade de migração SQL — usaremos INSERT via insert tool para os registros iniciais
- RLS já existente na `system_settings` permite leitura autenticada e escrita por admin
- O admin acessa em: **Dashboard > Configurações do Sistema > Card "Contratos Legais"**

### Arquivos alterados
- **Editado**: `src/components/SystemSettings.tsx` (nova seção de contratos)
- **Editado**: `src/components/BettorContractTermsDialog.tsx` (texto dinâmico)
- **Editado**: `src/components/Partner/PartnerContractTermsDialog.tsx` (texto dinâmico)
- **Dados**: 2 INSERTs na `system_settings`

