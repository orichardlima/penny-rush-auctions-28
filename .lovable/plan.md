

## Regra: Primeiros 2 Indicados Nao Pontuam para o Sponsor

### Contexto

Atualmente, quando um novo parceiro entra na rede, a funcao `propagate_binary_points` sobe pela arvore e adiciona pontos a TODOS os uplines, incluindo o sponsor direto. A nova regra estabelece que os 2 primeiros indicados diretos de cada sponsor sao "qualificadores" e nao geram pontos binarios para ele.

### Regra de Negocio Detalhada

- 1o indicado direto: nao gera pontos binarios para o sponsor
- 2o indicado direto: nao gera pontos binarios para o sponsor
- 3o indicado em diante: gera pontos binarios normalmente para o sponsor
- Em TODOS os casos, os pontos sao propagados normalmente para os uplines ACIMA do sponsor
- O Bonus de Indicacao (comissao em dinheiro) continua sendo pago normalmente para todos os indicados

### Como Contar os Indicados Diretos

A contagem sera feita consultando quantos registros em `partner_binary_positions` possuem `sponsor_contract_id` igual ao sponsor em questao. Isso inclui indicados em ambos os lados (esquerda e direita).

### Mudancas Necessarias

**1. Funcao SQL `propagate_binary_points`**

Alterar a funcao para receber um parametro adicional opcional `p_sponsor_contract_id` (o sponsor direto do novo parceiro). Durante o loop de propagacao, ao chegar no sponsor direto, verificar quantos indicados diretos ele ja possui. Se tiver 2 ou menos (contando o atual), pular a adicao de pontos PARA ESSE SPONSOR APENAS, mas continuar subindo normalmente.

Logica no loop:

```sql
WHILE v_parent_id IS NOT NULL LOOP
  -- Verificar se este upline eh o sponsor direto
  v_skip_points := false;
  
  IF v_parent_id = p_sponsor_contract_id THEN
    -- Contar indicados diretos deste sponsor
    SELECT COUNT(*) INTO v_direct_referrals_count
    FROM public.partner_binary_positions
    WHERE sponsor_contract_id = v_parent_id;
    
    -- Se tem 2 ou menos indicados, este ainda eh qualificador
    IF v_direct_referrals_count <= 2 THEN
      v_skip_points := true;
    END IF;
  END IF;
  
  IF NOT v_skip_points THEN
    -- Adicionar pontos normalmente
    UPDATE partner_binary_positions SET ...
  END IF;
  
  -- Registrar no log (mesmo se pulou)
  INSERT INTO binary_points_log ...
  
  -- Continuar subindo SEMPRE
  v_current_id := v_parent_id;
  SELECT parent_contract_id, position INTO v_parent_id, v_position
  FROM partner_binary_positions WHERE partner_contract_id = v_current_id;
END LOOP;
```

**2. Funcao SQL `position_partner_binary`**

Alterar a chamada de `propagate_binary_points` para passar o `sponsor_contract_id`:

```sql
-- Antes:
PERFORM public.propagate_binary_points(p_contract_id, v_points, 'new_partner');

-- Depois:
PERFORM public.propagate_binary_points(p_contract_id, v_points, 'new_partner', p_sponsor_contract_id);
```

**3. Nenhuma alteracao no frontend**

A regra eh puramente backend/SQL. O alerta de "binario nao ativado" ja foi implementado na etapa anterior. Os pontos simplesmente nao aparecerao para o sponsor ate o 3o indicado.

### Arquivos Modificados

- `supabase/migrations/[nova].sql` - Recriar `propagate_binary_points` com logica de skip e atualizar `position_partner_binary` para passar o sponsor
- `src/integrations/supabase/types.ts` - Atualizado automaticamente

### Impacto nos Dados Existentes

- A regra se aplica somente a NOVOS posicionamentos
- Parceiros ja posicionados mantem seus pontos atuais
- Para corrigir pontos historicos, seria necessaria uma correcao manual caso a caso

### Resumo Visual

```text
Sponsor: Richard (0 indicados diretos)

Joao entra (1o indicado):
  Richard: 0 pts (qualificador - pulou)
  Upline de Richard: +1000 pts

Maria entra (2o indicado):
  Richard: 0 pts (qualificador - pulou)
  Upline de Richard: +500 pts

Pedro entra (3o indicado):
  Richard: +1000 pts (ja qualificado!)
  Upline de Richard: +1000 pts
```
