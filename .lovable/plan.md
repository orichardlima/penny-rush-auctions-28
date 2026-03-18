
Problema confirmado: o bug não é mais no frontend. Os lances estão sendo gravados na tabela `bids`, mas o saldo em `profiles.bids_balance` continua intacto.

O que verifiquei:
- O frontend já chama `supabase.rpc('place_bid', ...)` em `src/pages/Index.tsx` e `src/pages/Auctions.tsx`.
- A função `public.place_bid` existe no banco e está sendo executada.
- Há vários registros recentes em `public.bids`, inclusive para usuários cujo saldo não mudou.
- O trigger `public.protect_profile_fields()` ainda faz isto:
  ```sql
  IF current_setting('role') != 'service_role' THEN
    NEW.bids_balance := OLD.bids_balance;
  END IF;
  ```
- Como a RPC roda com `SECURITY DEFINER` sob owner `postgres`, e não como `service_role`, o trigger reverte silenciosamente o `UPDATE` mesmo dentro da função `place_bid`.

Em resumo:
```text
Clique em dar lance
  -> RPC place_bid executa
  -> INSERT em bids funciona
  -> UPDATE em profiles acontece
  -> trigger protect_profile_fields sobrescreve NEW.bids_balance
  -> saldo permanece igual
```

Plano de correção:
1. Ajustar a proteção de `profiles` para permitir alterações de saldo apenas quando a operação vier de uma função segura do banco.
2. Corrigir `place_bid` para marcar explicitamente esse contexto seguro antes do `UPDATE`.
3. Validar que o saldo cai 1 a cada lance e que usuários comuns continuam sem poder editar `bids_balance` direto pelo client.

Implementação proposta:
- Criar uma nova migração SQL.
- Alterar `public.protect_profile_fields()` para aceitar uma flag de sessão, por exemplo:
  ```sql
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR current_setting('app.allow_sensitive_profile_update', true) = 'true'
  ```
  Se nenhuma condição for verdadeira, o trigger continua bloqueando `is_admin`, `is_blocked` e `bids_balance`.
- Atualizar `public.place_bid(...)` para fazer:
  ```sql
  PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
  ```
  antes do `UPDATE profiles`.
- Manter o restante da lógica atômica da RPC.

Por que essa abordagem é a correta:
- Não depende de `service_role`, que não é o contexto real da RPC.
- Preserva a proteção contra fraude no frontend.
- Permite apenas funções autorizadas do banco alterarem saldo.
- Evita remover ou enfraquecer o trigger global de segurança.

Validação após a correção:
- Dar 1 lance com um usuário autenticado e confirmar:
  - novo registro em `bids`
  - `profiles.bids_balance` decrementado em 1
- Dar múltiplos lances seguidos e verificar decremento cumulativo.
- Confirmar que update direto via client em `profiles.bids_balance` continua bloqueado.

Arquivos/áreas que serão ajustados:
- Nova migration em `supabase/migrations/`
  - atualizar `public.protect_profile_fields()`
  - atualizar `public.place_bid(...)`

Detalhe técnico importante:
- O erro veio de uma suposição incorreta: `SECURITY DEFINER` eleva privilégios do owner da função, mas não altera `current_setting('role')` para `service_role`. Como o trigger depende exatamente dessa string, ele nunca libera o desconto hoje.

<lov-actions>
<lov-suggestion message="Teste os lances de ponta a ponta após a correção: faça login, dê vários lances seguidos e confirme que o saldo cai 1 por lance e a UI atualiza corretamente.">Testar ponta a ponta</lov-suggestion>
<lov-suggestion message="Implemente a correção da trigger protect_profile_fields para aceitar uma flag de sessão segura e atualize a RPC place_bid para definir essa flag antes de descontar o saldo.">Corrigir trigger e RPC</lov-suggestion>
<lov-suggestion message="Adicione um histórico de consumo de lances por usuário mostrando quando cada lance foi usado, em qual leilão e o saldo antes/depois.">Adicionar extrato de lances</lov-suggestion>
</lov-actions>
