

## Plano: Adicionar cláusula sobre bônus de boas-vindas no contrato do apostador

### Alteração

**Arquivo: `src/components/BettorContractTermsDialog.tsx`**

Adicionar uma nova cláusula (CLÁUSULA 11) no `FALLBACK_TEXT`, antes das Disposições Gerais, informando que:

- Os lances de bônus de boas-vindas (cadastro) são exclusivamente para experimentação da plataforma
- Lances bônus não têm validade para arrematação de produtos
- Apenas lances adquiridos mediante pagamento são válidos para arrematar itens em leilões
- Arrematações realizadas exclusivamente com lances bônus serão consideradas nulas

A atual "CLÁUSULA 10 — DISPOSIÇÕES GERAIS" será renumerada para CLÁUSULA 12, e a "CLÁUSULA 11" original passará a ser CLÁUSULA 12.

### Texto da nova cláusula

```
CLÁUSULA 11 — BÔNUS DE BOAS-VINDAS
Ao se cadastrar na plataforma, o usuário poderá receber lances gratuitos como bônus de boas-vindas. Esses lances têm finalidade exclusivamente experimental, permitindo ao usuário conhecer e testar o funcionamento dos leilões da plataforma.
Os lances de bônus de boas-vindas NÃO possuem validade para arrematação de produtos. Apenas lances adquiridos mediante pagamento são válidos para fins de arrematação.
Caso um usuário arremate um produto utilizando exclusivamente lances de bônus (sem ter adquirido lances pagos), a arrematação será considerada nula e sem efeito, não gerando obrigação de entrega por parte da plataforma.
```

