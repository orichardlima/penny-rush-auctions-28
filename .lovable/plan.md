

## Limpar templates fracos e gerar novos premium (R$ 800 – R$ 3.000)

### Diagnóstico

- **24 templates ativos abaixo de R$ 200** (cabos, películas, pop sockets, gift cards baixos, multímetros, lanternas) — pouco apelo.
- **12 templates ativos entre R$ 200 e R$ 800** (perfumes, drones baratos, soundbars de entrada, headsets básicos) — médio/baixo apelo.
- Vários estão em uso em leilões existentes (ex.: "Mi Band 10" com 99 leilões, "JBL 510BT" com 87) — **não posso deletar fisicamente** sem quebrar referências históricas.

### Mudança 1 — Desativar (soft delete) templates fracos

Migration SQL:
```sql
UPDATE product_templates 
SET is_active = false, updated_at = now()
WHERE market_value < 800 AND is_active = true;
```

Resultado: 36 templates somem do gerador automático de leilões (`auto-replenish-auctions`), mas continuam visíveis no admin com filtro "Inativos" e leilões antigos permanecem intactos.

**Exceção opcional:** preservar 2 itens emblemáticos que já viraram tradição no catálogo? (Mi Band 10 — 99 leilões; JBL 510BT — 87). Vou **manter esses 2 ativos** porque já têm histórico forte de engajamento, e desativar os outros 34. Se quiser desativar tudo sem exceção, basta dizer.

### Mudança 2 — Inserir 30 novos templates premium (R$ 800 – R$ 3.000)

Distribuição equilibrada por categoria, todos `tier='premium'`, `is_active=true`, sem `image_url` (gerados depois pelo gerador de imagens IA em lote):

**Eletrônicos / Smartphones / Games (15 itens):**
- Smart TV 50" 4K (R$ 2.299), Smart TV 43" 4K (R$ 1.799)
- Notebook 15" Intel i5 8GB (R$ 2.799)
- iPhone 12 64GB Seminovo (R$ 2.499), Galaxy A55 5G (R$ 2.199)
- AirPods Pro 2 (R$ 1.899), JBL Charge 5 (R$ 999)
- Apple Watch SE 2 (R$ 2.199), Galaxy Watch 6 (R$ 1.499)
- iPad 9ª Geração 64GB (R$ 2.799), Tablet Galaxy Tab A9+ (R$ 1.299)
- PlayStation 4 Slim 1TB (R$ 1.799), Nintendo Switch Lite (R$ 1.499)
- Xbox Series S 512GB (R$ 2.299), Monitor Gamer 24" 144Hz (R$ 999)

**Casa / Eletrodomésticos (10 itens):**
- Air Fryer 12L Oven (R$ 899), Robô Aspirador WiFi (R$ 1.299)
- Geladeira Frost Free 300L (R$ 2.499), Micro-ondas 32L (R$ 899)
- Máquina Lava e Seca 11kg (R$ 2.999), Fogão 5 Bocas Inox (R$ 1.499)
- Cafeteira Espresso Automática (R$ 1.199), Aspirador Vertical sem Fio (R$ 999)
- Purificador de Água Eletrônico (R$ 899), Cooktop Indução 4 Bocas (R$ 1.799)

**Mobilidade / Outros (5 itens):**
- Patinete Elétrico 350W (R$ 1.999), Bicicleta Elétrica Dobrável (R$ 2.799)
- Drone 4K com GPS (R$ 1.499), Câmera DSLR Canon Kit (R$ 2.799)
- Smartwatch GPS Garmin (R$ 1.299)

Migration SQL (`INSERT INTO product_templates ...`) com 30 linhas — todos com `description` curta vendedora e `category` correta.

### Mudança 3 — Após inserção, gerar imagens IA dos novos

Não há código a alterar — você usa o painel `Templates de Produtos` → botão **"Gerar imagens em lote"** já existente, marca filtro "Apenas faltando imagem" + tier "Premium" e roda. As 30 imagens serão geradas pelo `generate-template-image`.

### O que NÃO muda

- Estrutura da tabela, hooks, filtros, UI do admin, geração de leilões, regra "mandatory bot winner", histórico de leilões antigos — tudo intacto.
- Templates desativados continuam servindo aos leilões já criados/finalizados (vínculo é por título, não por FK).
- Gerador automático (`auto-replenish-auctions`) só sorteia entre `is_active = true`, então passará a sortear apenas entre templates fortes.

### Resultado

| Antes | Depois |
|---|---|
| 36 templates ativos < R$ 800 | 2 (apenas Mi Band 10 + JBL 510BT) |
| 21 templates ativos R$ 800–3000 | 51 (21 originais + 30 novos premium) |
| Catálogo dominado por acessórios baratos | Catálogo focado em produtos desejados |

