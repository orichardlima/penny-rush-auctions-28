## Central de Downloads

Página `/downloads` acessível a qualquer usuário logado, com gestão completa via Painel Admin.

### 1. Banco de dados
Nova tabela `platform_downloads`:
- `id`, `title`, `description`, `category` (enum: `contrato`, `apresentacao`, `kit_divulgacao`, `regulamento`, `outros`), `file_url`, `file_name`, `file_size`, `mime_type`, `display_order`, `is_active`, `download_count`, `created_at`, `updated_at`, `created_by`.
- RLS: SELECT para `authenticated` (apenas `is_active=true`); INSERT/UPDATE/DELETE apenas para admin via `is_admin_user()`.
- GRANTs explícitos para `authenticated` e `service_role`.

Nova tabela `platform_download_logs` (auditoria opcional):
- `id`, `download_id`, `user_id`, `downloaded_at`, `ip_address`.
- Trigger incrementa `download_count` automaticamente.

### 2. Storage
Bucket privado `platform-downloads` no Supabase Storage. Acesso via Signed URL (validade 5 min) gerada sob demanda — garante que apenas usuários logados baixem.

### 3. Frontend — Usuário (`/downloads`)
Nova página `src/pages/Downloads.tsx`:
- Cards agrupados por categoria com ícone (FileText, Presentation, Megaphone, Scale).
- Cada card: título, descrição, tamanho, botão "Baixar" (gera signed URL e dispara download).
- Responsivo (grid 1/2/3 colunas).
- Empty state quando categoria está vazia.
- Link adicionado no menu do Header e no Footer.

### 4. Frontend — Admin
Nova aba "Downloads" em `AdminDashboard.tsx` com componente `PlatformDownloadsManager`:
- Lista todos os arquivos (ativos + inativos) com ordenação drag/seta.
- Botão "Novo arquivo": modal com upload, título, descrição, categoria, ordem.
- Ações por linha: editar metadados, ativar/desativar, excluir (remove do storage + tabela).
- Coluna com contador de downloads.

### 5. Conteúdo inicial
A página fica pronta vazia. O admin sobe os 4 materiais (Contrato APN, Apresentação, Kit, Regulamento) pelo painel após a publicação — sem precisar de deploy.

### Detalhes técnicos
- Limite de upload: 20 MB por arquivo (validação client + edge).
- Categorias como enum Postgres `download_category` para integridade.
- Signed URL gerada via `supabase.storage.from('platform-downloads').createSignedUrl(path, 300)`.
- Sem alterações em UI/fluxos existentes — apenas adições.

### Fora de escopo
- Versionamento de arquivos (substitui in-place).
- Notificação push quando admin sobe novo material (pode ser fase 2).
- Permissões granulares por tipo de usuário (todos logados veem tudo).

Aprovar para eu implementar?