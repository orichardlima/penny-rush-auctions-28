

# Adicionar Templates Pre-definidos na Central de Anuncios

## Objetivo

Permitir que o admin selecione um tipo de template (Stories, Feed, WhatsApp) ao cadastrar materiais promocionais, facilitando a organizacao do conteudo e orientando os parceiros sobre onde usar cada material.

## Alteracoes

### 1. Migracao no banco de dados

Adicionar coluna `template_type` na tabela `ad_center_materials`:

```sql
ALTER TABLE ad_center_materials
ADD COLUMN template_type text DEFAULT NULL;
```

Valores possiveis: `stories`, `feed`, `whatsapp`, ou `NULL` (sem template especifico).

### 2. Hook `useAdCenter.ts`

- Adicionar `template_type` a interface `AdCenterMaterial`
- Incluir `template_type` nas funcoes `createMaterial` e `updateMaterial`

### 3. Componente Admin `AdCenterMaterialsManager.tsx`

No formulario de criacao/edicao:
- Adicionar seletor visual com 3 opcoes de template (Stories, Feed, WhatsApp) + opcao "Sem template"
- Cada opcao mostra icone, nome e dimensoes recomendadas
- O template selecionado sera salvo na coluna `template_type`

Na tabela de listagem:
- Exibir badge com o tipo de template ao lado do titulo do material

### 4. Dashboard do Parceiro `AdCenterDashboard.tsx`

- Exibir badge do template no card "Material de Hoje" para o parceiro saber o formato ideal (ex: "Stories 1080x1920")

## Templates pre-definidos

| Template  | Dimensoes recomendadas | Icone       |
|-----------|----------------------|-------------|
| Stories   | 1080 x 1920 px       | Smartphone  |
| Feed      | 1080 x 1080 px       | LayoutGrid  |
| WhatsApp  | 800 x 800 px         | MessageCircle |

## O que NAO muda

- Logica de confirmacao de divulgacao
- Calculo do progresso semanal e desbloqueio dos 30%
- Regra de queima do cap de 200%
- Nenhuma outra tabela ou componente fora do escopo

