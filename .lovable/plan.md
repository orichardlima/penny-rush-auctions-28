

## Mostrar Impacto da Central de Anuncios na Aba de Repasses

### Problema
O parceiro ve o "Acumulado: R$ 111,99" na aba Repasses, mas esse valor representa 100% do rendimento bruto. O valor real que ele recebera depende do progresso na Central de Anuncios (70% base + ate 30% bonus). Hoje, essa informacao so aparece na aba "Central de Anuncios", obrigando o parceiro a cruzar dados mentalmente entre duas abas.

### Solucao
Adicionar um mini-resumo do impacto da Central de Anuncios diretamente no card "Semana em Andamento", logo abaixo do acumulado. Isso mostra ao parceiro, de forma clara:

1. O valor bruto acumulado (como ja esta)
2. O percentual de desbloqueio atual (ex: 76%)
3. O valor estimado do repasse real (bruto x percentual)
4. Um link para a aba "Central de Anuncios" caso queira melhorar o percentual

### Exemplo Visual

```text
Acumulado: R$ 111,99
1.12% do aporte

  Desbloqueio: 76% (3 de 5 dias)
  Repasse estimado: R$ 85,11
  [Completar na Central de Anuncios ->]

Sera pago em: Domingo, 22/02
```

Se o parceiro tiver 100% desbloqueado, a mensagem muda para:

```text
Acumulado: R$ 111,99
1.12% do aporte

  100% desbloqueado - Voce recebera o valor integral!

Sera pago em: Domingo, 22/02
```

### Mudancas Tecnicas

**Arquivo: `src/components/Partner/PartnerDashboard.tsx`**

- Importar o hook `useAdCenter` (ja existente) para obter `weekProgress`
- Abaixo do bloco "Acumulado" (linha ~810), adicionar um pequeno bloco informativo com:
  - `weekProgress.unlockPercentage` para mostrar o percentual
  - `totalPartnerShare * (unlockPercentage / 100)` para o valor estimado
  - `weekProgress.completedDays` / `weekProgress.requiredDays` para o progresso
  - Botao/link que muda a aba ativa para "ads" (Central de Anuncios)
- Estilizar com cores condicionais: verde se 100%, amarelo/laranja se abaixo

**Arquivo: `src/hooks/useAdCenter.ts`**

- Nenhuma alteracao necessaria - o hook ja retorna `weekProgress` com `unlockPercentage`, `completedDays`, `requiredDays` e `bonusPercentage`

### Impacto
- Apenas a aba "Repasses" do PartnerDashboard e alterada
- Nenhuma alteracao na Central de Anuncios, Saques, Indicacoes ou Rede Binaria
- Nenhuma alteracao no calculo real de repasses (edge function)
- Apenas informacao visual adicional para o parceiro

