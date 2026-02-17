

## Redirecionar Parceiros para o Escritorio apos Login

### Problema
Quando um parceiro faz login, ele vai para `/dashboard` (painel generico). O ideal e que parceiros ativos sejam levados diretamente para `/minha-parceria` (escritorio do parceiro).

### Solucao
Adicionar uma verificacao no `Dashboard.tsx`: apos carregar o perfil do usuario, consultar se ele possui um contrato de parceiro ativo (`partner_contracts` com `status = 'ACTIVE'`). Se sim, redirecionar automaticamente para `/minha-parceria`.

### Logica

```text
Usuario loga --> Dashboard carrega perfil
                    |
              E admin? --> Mostra AdminDashboard (sem mudanca)
                    |
              Tem contrato ativo? --> Sim --> Redireciona para /minha-parceria
                    |
                   Nao --> Mostra UserDashboard (sem mudanca)
```

### Detalhes Tecnicos

**Arquivo modificado: `src/pages/Dashboard.tsx`**

- Adicionar um `useEffect` que, apos o `profile` estar carregado e o usuario **nao** ser admin, faz uma query rapida:
  ```text
  SELECT id FROM partner_contracts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1
  ```
- Se retornar resultado, `navigate('/minha-parceria')` automaticamente
- Se nao retornar, continua mostrando o `UserDashboard` normalmente
- Admins nao sao afetados (a verificacao so ocorre para usuarios comuns)

### Impacto
- Nenhuma alteracao na UI existente do Dashboard, UserDashboard ou AdminDashboard
- Nenhuma alteracao na pagina de login (Auth.tsx)
- Apenas uma consulta adicional leve ao banco para usuarios nao-admin
- Se o usuario acessar `/dashboard` diretamente via URL e for parceiro, sera redirecionado

