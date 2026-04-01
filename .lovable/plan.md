

# Liberar Afiliados para Todos os Parceiros de Expansão

## Resumo

Atualmente, apenas parceiros com plano **Legend** ativo podem ativar o programa de afiliados. A mudança remove essa restrição para que **qualquer parceiro com contrato ACTIVE** possa se tornar afiliado.

## Alteração

### `src/components/Affiliate/AffiliateOnboarding.tsx`

- Remover o filtro `.eq('plan_name', 'Legend')` na query de verificação (linha 33)
- Manter apenas `.eq('status', 'ACTIVE')` para validar que o usuário tem um contrato ativo
- Renomear variável `hasLegend` para `hasActiveContract` para clareza
- Atualizar textos da tela de bloqueio: trocar referência ao plano "Legend" por uma mensagem genérica sobre ter um plano de parceiro ativo

### Nada mais alterado

- Nenhum outro componente, hook, tabela ou fluxo existente
- Bloqueios de inadimplência permanecem intactos
- Fluxo de criação de conta de afiliado permanece igual

