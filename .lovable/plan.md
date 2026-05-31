## Adicionar cláusula de Troca de Patrocinador ao contrato do Parceiro

Inserir uma nova cláusula no contrato do parceiro descrevendo as regras da saída da rede do patrocinador e troca de patrocinador, alinhada ao fluxo já implementado.

### Onde alterar

1. **Banco** — atualizar `system_settings.setting_value` onde `setting_key = 'contract_partner_text'` (fonte usada pelo `PartnerContractTermsDialog` via `useSystemSettings`).
2. **Fallback no código** — atualizar a constante `FALLBACK_TEXT` em `src/components/Partner/PartnerContractTermsDialog.tsx` para manter o texto sincronizado caso o setting não esteja carregado.

Nenhuma outra UI, fluxo ou lógica será alterada.

### Texto a inserir (nova Cláusula 10, renumerando as seguintes)

```
CLÁUSULA 10 — TROCA DE PATROCINADOR E SAÍDA DA REDE
O PARCEIRO poderá solicitar a saída da rede do seu patrocinador atual, sujeito às seguintes condições:
• A solicitação só poderá ser feita dentro do prazo de 30 (trinta) dias contados da data de cadastro do contrato. Após esse prazo, o vínculo com o patrocinador torna-se definitivo.
• Ao confirmar a saída, todos os bônus de indicação pendentes relacionados ao PARCEIRO serão automaticamente cancelados, e os bônus já disponíveis na conta do patrocinador anterior poderão ser revertidos, conforme a política vigente.
• Após a saída, o PARCEIRO terá o prazo de 7 (sete) dias para escolher um novo patrocinador. Caso não escolha dentro desse prazo, será automaticamente reintegrado à rede do patrocinador anterior.
• Após o uso da opção de saída, o PARCEIRO ficará sujeito a um período de carência de 90 (noventa) dias antes de poder solicitar nova troca de patrocinador.
• A troca de patrocinador não altera o valor do aporte, o teto de recebimento, nem o histórico de repasses já realizados.
```

A cláusula atual "10 — PRIVACIDADE E DADOS" passa a ser **11**, e "11 — DISPOSIÇÕES GERAIS" passa a ser **12**.

### Passos de execução (em build mode)

1. Migração de dados (`UPDATE system_settings ...`) substituindo o `setting_value` do `contract_partner_text` pelo texto completo com a nova cláusula e renumeração.
2. Editar `FALLBACK_TEXT` em `PartnerContractTermsDialog.tsx` espelhando o novo texto.

### Fora do escopo

- Nenhuma mudança em UI, no fluxo de aceite, em hooks ou no contrato do apostador.
- Sem alterações no contrato já aceito por parceiros existentes (aceites passados permanecem com o texto vigente na época).
