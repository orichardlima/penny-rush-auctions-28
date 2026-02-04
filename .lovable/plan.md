
# Implementar Upload de Imagem na Central de Anúncios

## Resumo

Alterar o formulário de criação/edição de materiais promocionais para utilizar **upload de arquivo** ao invés de inserção de URL. O admin poderá arrastar ou selecionar uma imagem do computador, que será automaticamente enviada para um bucket do Supabase Storage.

---

## Alterações Necessárias

### 1. Banco de Dados - Novo Bucket de Storage

Criar um bucket dedicado para imagens da Central de Anúncios:

| Configuração | Valor |
|--------------|-------|
| Nome do bucket | `ad-center-materials` |
| Público | Sim (para exibição nas redes sociais) |
| Limite de tamanho | 5MB |
| Políticas RLS | Admins podem fazer upload/editar/excluir; Qualquer um pode visualizar |

### 2. Hook `useAdCenter.ts`

Adicionar função de upload no hook admin:

```typescript
const uploadMaterialImage = async (file: File): Promise<string | null> => {
  // Gera nome único para o arquivo
  const fileName = `${Date.now()}-${file.name}`;
  
  // Faz upload para o Supabase Storage
  const { data, error } = await supabase.storage
    .from('ad-center-materials')
    .upload(fileName, file);
    
  if (error) return null;
  
  // Retorna URL pública da imagem
  return supabase.storage
    .from('ad-center-materials')
    .getPublicUrl(fileName).data.publicUrl;
};
```

### 3. Componente `AdCenterMaterialsManager.tsx`

Substituir o campo de URL por área de upload:

**Antes (campo de texto):**
```text
┌─────────────────────────────────────────────┐
│ URL da Imagem                               │
│ [https://...                              ] │
│ Cole a URL de uma imagem hospedada          │
└─────────────────────────────────────────────┘
```

**Depois (área de upload):**
```text
┌─────────────────────────────────────────────┐
│ Imagem do Material                          │
│ ┌─────────────────────────────────────────┐ │
│ │ ┌───────┐                               │ │
│ │ │ THUMB │  [X] material-fevereiro.jpg   │ │
│ │ └───────┘       256KB - Processada      │ │
│ │                                         │ │
│ │ ou arraste uma nova imagem              │ │
│ └─────────────────────────────────────────┘ │
│ Formatos: JPEG, PNG, WebP - Máximo: 5MB     │
└─────────────────────────────────────────────┘
```

**Funcionalidades:**
- Reutilizar o componente `ImageUploadPreview` existente (modo compacto)
- Preview da imagem antes de salvar
- Otimização automática (WebP, compressão)
- Ao editar, mostrar imagem atual com opção de trocar

---

## Fluxo de Upload

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO DE CRIAÇÃO                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. Admin seleciona/arrasta imagem                             │
│              │                                                  │
│              v                                                  │
│   2. ImageUploadPreview processa e valida                       │
│      (redimensiona, comprime, converte para WebP)               │
│              │                                                  │
│              v                                                  │
│   3. Admin preenche título, legenda, data alvo                  │
│              │                                                  │
│              v                                                  │
│   4. Clica "Criar Material"                                     │
│              │                                                  │
│              v                                                  │
│   5. Hook faz upload da imagem processada para Storage          │
│      supabase.storage.from('ad-center-materials').upload(...)   │
│              │                                                  │
│              v                                                  │
│   6. Recebe URL pública da imagem                               │
│              │                                                  │
│              v                                                  │
│   7. Insere registro na tabela ad_center_materials              │
│      com image_url = URL pública                                │
│              │                                                  │
│              v                                                  │
│   8. Sucesso! Material disponível para parceiros                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| Nova migração SQL | Criar bucket `ad-center-materials` com políticas RLS |
| `src/hooks/useAdCenter.ts` | Adicionar função `uploadMaterialImage` no hook admin |
| `src/components/Admin/AdCenterMaterialsManager.tsx` | Substituir input de URL pelo `ImageUploadPreview` |

---

## Detalhes de Implementação

### Migração SQL

```sql
-- Criar bucket para materiais da Central de Anúncios
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ad-center-materials', 'ad-center-materials', true, 5242880);

-- Políticas de acesso
CREATE POLICY "Qualquer um pode ver materiais"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-center-materials');

CREATE POLICY "Admins podem fazer upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ad-center-materials' AND is_admin_user(auth.uid()));

CREATE POLICY "Admins podem atualizar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'ad-center-materials' AND is_admin_user(auth.uid()));

CREATE POLICY "Admins podem deletar"
ON storage.objects FOR DELETE
USING (bucket_id = 'ad-center-materials' AND is_admin_user(auth.uid()));
```

### Modificações no Componente

O formulário terá:
- Estado para armazenar o arquivo selecionado (`selectedFile`)
- Integração com `ImageUploadPreview` em modo compacto
- Lógica para fazer upload ao clicar em "Criar Material"
- Na edição: exibir imagem atual com botão para substituir

---

## Comportamento na Edição

Quando o admin editar um material existente:
1. Mostrar thumbnail da imagem atual
2. Exibir botão "Trocar Imagem"
3. Se nova imagem for selecionada, fazer upload ao salvar
4. Manter imagem antiga se nenhuma nova for selecionada
