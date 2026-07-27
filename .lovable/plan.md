
# Estado atual do Programa Pontos Show

## 1. Escritório do Administrador — `/admin/pontos-loja`

Página existe, é lazy-loaded, protegida por `profile.is_admin`, com 5 abas:

| Aba | O que faz | Situação real |
|---|---|---|
| **Configurações** | Lê/edita flags booleanas, parâmetros numéricos, datas de corte e JSONs (audience, elegibilidade, etc). | ❌ **QUEBRADA.** O código consulta as colunas `setting_key`/`setting_value`, mas as tabelas reais em produção usam `key`/`value`. A aba abre em branco e qualquer tentativa de salvar retorna erro. |
| **Regras** | Lista `points_rules` e permite criar nova regra (nome, lances/ponto, multiplicador, ativa). | ⚠️ **Parcial.** Lista funciona. **Criação está incompleta**: o formulário só envia `name/bids_per_point/multiplier/is_active`; a Fase 3 exige também `rule_code`, `version`, `points_per_block`. Inserir uma regra nova pela UI hoje falha ou cria um registro inconsistente que os triggers de imutabilidade não protegem corretamente. A regra oficial `POINTS_STANDARD v1` (12:1) já está semeada, inativa, pronta para ser ligada pela RPC atômica. |
| **Categorias** | CRUD simples de categorias da loja. | ✅ Funciona. Nenhuma categoria cadastrada ainda (opcional). |
| **Itens** | CRUD de produtos, edição de estoque (+/-), status DRAFT/ACTIVE/PAUSED/OUT_OF_STOCK/ARCHIVED. | ✅ Funciona. **3 produtos já cadastrados como ACTIVE**: Fone Bluetooth (150 pts, estoque 2), Caixa de Som (300 pts, estoque 1), PS5 Slim (1000 pts, estoque 1). Todos com limite 1/usuário. |
| **Resgates** | Fila com filtros PENDING/APPROVED/REJECTED/ALL, ações Aprovar / Rejeitar (com motivo) via RPCs `redeem_approve` / `redeem_reject`. | ✅ Funciona. Nenhum resgate ainda. |

## 2. Loja do usuário — `/loja-show`

- ✅ Rota registrada e protegida por login.
- ✅ Gate por RPC `store_visible_for`. Enquanto `points_store_enabled=false` a página mostra "Loja em breve" — atualmente é isso que qualquer usuário vê.
- ✅ Exibe saldo da wallet, lista só itens ACTIVE ordenados por destaque, botão Resgatar chama `redeem_create` com idempotency key, redireciona para `/meus-resgates`.
- ✅ Bloqueia botão quando estoque zerado ou saldo insuficiente.

## 3. Meus resgates — `/meus-resgates`

- ✅ Rota registrada. Lista os resgates do próprio usuário (a página está criada e usa as mesmas RPCs).

## 4. Backend / segurança

- ✅ RLS ligada em `points_program_settings_*`, `points_rules`, `points_store_items`, `points_store_categories`, `points_redemptions`, `points_wallets`.
- ✅ Todas as RPCs necessárias existem: `store_visible_for`, `redeem_create`, `redeem_approve`, `redeem_reject`, `is_admin_user`, `points_admin_activate_pilot`, `credit_paid_bid_purchase`, `reverse_paid_bid_purchase`, `points_settle_auction`, `consume_bid_lots`, `is_auction_final_for_points`.
- ✅ Triggers de imutabilidade e anti-delete em `points_rules` ativos.
- ✅ Webhooks VeoPag e MagenPay deployados com fluxo canônico.
- ✅ Todas as flags neutras (`false` / `NULL` / `off`). Nada acontece em produção ainda.

## Conclusão honesta

O programa está pronto na infraestrutura e na loja do usuário, mas **o escritório do admin tem 2 bugs que impedem o piloto real**:

1. A aba Configurações não consegue ler nem gravar as flags porque foi codificada com nomes de coluna errados.
2. A aba Regras cria regras incompletas.

Se você tentar antes das 13h ajustar uma flag pela UI, vai encontrar tela vazia / erro. Precisamos corrigir isso antes do corte.

---

# Plano de correção (só as 2 abas quebradas — nada mais é tocado)

### Detalhes técnicos

**Fix 1 — `src/pages/AdminPontosLoja.tsx`, `useSettings` e `ConfigTab`:**
- Trocar `select("setting_key,setting_value")` por `select("key,value")` nas 4 queries.
- Trocar `.eq("setting_key", key)` por `.eq("key", key)` no `update`.
- Trocar todas as leituras `r.setting_key` / `r.setting_value` por `r.key` / `r.value` (nos editores Num/Time/Json e nos maps das listas).
- Ajustar o tipo `SettingRow` para `{ key: string; value: any }`.

**Fix 2 — `RulesTab`:**
- Adicionar ao form: `rule_code` (texto, default `POINTS_STANDARD`), `version` (número, default próxima versão), `points_per_block` (número, default 1).
- Enviar esses campos no `insert`.
- Mostrar `rule_code` e `version` na tabela junto de `bids_per_point`.
- Trocar o toggle de "Ativa" por um botão "Ativar" que chama a RPC atômica `points_admin_activate_pilot` (evita ativar regra por UPDATE direto e passar por cima da validação exigida pela Fase 3).

Nada mais no admin, na loja, nos webhooks, nas RPCs ou no banco é alterado. As flags continuam neutras. Não há qualquer ativação de programa neste plano — só o conserto do escritório.

### Verificação
- Abrir `/admin/pontos-loja`, aba Configurações: as 8 flags booleanas, 1 numérica, 2 datas e 8 JSONs aparecem, editam e salvam.
- Aba Regras: `POINTS_STANDARD v1` aparece; botão "Ativar" chama a RPC (só será usado às 13h após o smoke test).
- Sem regressão nas abas Categorias, Itens e Resgates.

Depois desse fix, o cenário para as 13h fica: gerar a compra real de R$ 5,00, validar webhook + idempotência, marcar `webhooks_validated=true` e rodar `points_admin_activate_pilot` com `audience_mode='all'` conforme você já autorizou.
