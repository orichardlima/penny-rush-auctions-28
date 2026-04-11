

# Mostrar dados de contato no UserProfileCard para admins

## Problema
Os dados de contato (telefone, CPF, endereço) só aparecem quando o admin abre o dialog de edição. O admin quer visualizar esses dados diretamente no card.

## Solução
Adicionar uma seção "Dados de Contato" no `UserProfileCard`, visível apenas para admins, buscando os campos da tabela `profiles`.

### Alteração em `src/components/UserProfileCard.tsx`

1. **Nova query** para buscar dados de contato do usuário (habilitada apenas se `isAdmin`):
   ```ts
   const { data: contactInfo } = useQuery({
     queryKey: ['user-contact-info', userId],
     queryFn: async () => {
       const { data } = await supabase
         .from('profiles')
         .select('cpf, phone, cep, street, number, complement, neighborhood, city, state')
         .eq('user_id', userId)
         .single();
       return data;
     },
     enabled: !!isAdmin,
   });
   ```

2. **Nova seção visual** no card (após o saldo, antes das métricas), com ícones de Phone, MapPin, IdCard:
   - **Telefone**: formatado com `formatPhone()`
   - **CPF**: formatado com `formatCPF()` 
   - **Endereço**: rua, número, complemento, bairro, cidade/UF, CEP — em uma linha compacta
   - Campos vazios exibem "Não informado" em cinza discreto

3. **Imports adicionais**: `Phone, MapPin, IdCard` do lucide-react e `formatCPF, formatPhone` de `@/utils/validators`

Nenhuma outra funcionalidade será alterada.

