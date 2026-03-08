

## Plano: Vincular Carolina Bastos como indicada do afiliado Paulo Mota

### Dados confirmados
- **Carolina Bastos Santos Souza**: `user_id = 27057919-a547-486b-8903-f6ad2bbdd022`
- **Paulo Mota (LUISBD98)**: `affiliate_id = 92e39f3b-4ea7-4b9d-a193-5ab981b4112a`
- Nenhum vínculo existente na tabela `affiliate_referrals`.

### Alteração
Executar um `INSERT` na tabela `affiliate_referrals` com:
- `affiliate_id`: `92e39f3b-4ea7-4b9d-a193-5ab981b4112a`
- `referred_user_id`: `27057919-a547-486b-8903-f6ad2bbdd022`
- `converted`: `true` (já é usuária ativa)
- `click_source`: `'manual_admin_link'`

Adicionalmente, incrementar `total_referrals` e `total_conversions` do afiliado Paulo Mota em +1.

Nenhuma alteração no frontend.

