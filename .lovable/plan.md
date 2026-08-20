# Blindagem do vínculo de rede na ativação por saldo/crédito

## Situação atual (verificada)

A função de ativação já resolve o patrocinador em cascata:

1. Intenção de pagamento anterior com indicador
2. Contrato anterior do indicado
3. Indicação de afiliado convertida
4. Código de parceiro gravado no perfil no cadastro (correção aplicada ontem)

O contrato é criado já com o indicador preenchido, e os gatilhos de banco (bônus em cascata, posição na rede/equipes, lances bônus) disparam automaticamente no insert. Ou seja: o caso do `testedesaldo@gmail.com` não se repete quando o indicado se cadastrou por um link/código de indicação.

Resta um único ponto de falha: se o indicado se cadastrou **sem** nenhum código de indicação e nunca teve intenção/afiliado, o contrato ainda é criado sem vínculo de rede (hoje apenas gera um aviso no log).

## O que fazer

1. **Bloquear a ativação silenciosa sem indicador**: quando nenhuma das quatro fontes identificar o patrocinador, a função retorna erro claro em vez de criar contrato órfão.
2. **Permitir informar o indicador na hora**: no modal "Ativar Indicado", quando o sistema não encontrar vínculo, exibir campo para o patrocinador confirmar/informar o código de indicação que será usado (respeitando a regra de que o pagador não pode ser o indicador quando a origem for outra pessoa).
3. **Aviso preventivo no modal**: antes de confirmar, mostrar o nome do indicador que será registrado, para o líder validar.

## Detalhes técnicos

- `supabase/functions/sponsor-activate-partner/index.ts`: transformar o `console.warn` de "ativação sem indicador" em retorno 400; aceitar parâmetro opcional `referral_code_override` validado contra `partner_contracts.referral_code` ACTIVE.
- `SponsorActivateDialog`: pré-consulta do indicador resolvido (via RPC/edge leve ou consulta ao perfil do indicado) e campo de código quando ausente.
- Nenhuma alteração em regras financeiras, tetos, bônus ou nos gatilhos de banco.
