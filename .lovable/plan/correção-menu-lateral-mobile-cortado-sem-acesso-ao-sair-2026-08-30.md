# Correção — Menu lateral mobile cortado (sem acesso ao "Sair")

## Problema confirmado
No `src/components/Header.tsx`, o menu mobile (Sheet lateral direito) usa um `<div className="flex flex-col space-y-4 mt-6">` com todo o conteúdo empilhado (perfil, ações rápidas, ~8 itens de navegação, botão "Sair da Conta"). Não há rolagem: em telas menores o conteúdo ultrapassa a altura visível e o botão **Sair da Conta** (e itens finais como "Vencedores") ficam inacessíveis — exatamente como mostra o print enviado.

## Solução
Ajuste apenas no `SheetContent` do menu mobile em `Header.tsx`:

1. Tornar o `SheetContent` um container de coluna com altura total (`h-full flex flex-col`) e padding controlado.
2. Envolver o conteúdo rolável (perfil + ações rápidas + navegação) em uma área com `flex-1 overflow-y-auto`, garantindo rolagem suave no mobile.
3. Fixar o botão **"Sair da Conta"** em um rodapé sempre visível na base do menu (fora da área de rolagem), com separador — assim o logout fica acessível mesmo sem rolar.

## Escopo
- Arquivo alterado: `src/components/Header.tsx` (somente a estrutura do Sheet mobile).
- Nenhuma mudança em funcionalidades, rotas, desktop ou demais componentes.

## Verificação
- Teste via Playwright em viewport mobile (ex.: 390x844): abrir o menu, conferir que todos os itens de navegação são alcançáveis por rolagem e que o botão "Sair da Conta" está visível e clicável.
- Print de confirmação ao final.
