

# Plano: Ajustar tempo de exibição de leilões finalizados + filtrar leilões ocultos

## Duas mudanças em uma migração

### 1. Atualizar `finished_auctions_display_hours` de 48 para 18

```sql
UPDATE system_settings 
SET setting_value = '18' 
WHERE setting_key = 'finished_auctions_display_hours';
```

O frontend (`useAuctionData.ts`) já lê essa configuração dinamicamente — nenhuma mudança de código necessária.

### 2. Filtrar leilões ocultos na policy SELECT (correção de segurança pendente)

```sql
DROP POLICY "Anyone can view auctions" ON auctions;
CREATE POLICY "Anyone can view auctions" ON auctions
  FOR SELECT TO public
  USING (is_hidden = false OR is_admin_user(auth.uid()));
```

## Resultado

- Leilões finalizados ficam visíveis na home por **18 horas** (em vez de 48)
- Leilões marcados como `is_hidden = true` ficam invisíveis para não-admins
- Admins continuam vendo tudo
- Zero mudanças no frontend

