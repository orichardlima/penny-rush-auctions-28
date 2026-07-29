## Problema

No `index.html`, as tags de preview social apontam para a imagem da Lovable:

```html
<meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
<meta name="twitter:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
```

É por isso que o WhatsApp mostra o banner "Build apps and websites by chatting with AI".

## Solução

1. Gerar uma imagem de preview 1200x630 com a identidade Show de Lances (logo, fundo escuro com o roxo/primário da marca e a chamada "Ganhe produtos incríveis por centavos").
2. Publicar a imagem em `public/og-image.jpg` (URL absoluta `https://showdelances.com/og-image.jpg`, o domínio principal do projeto).
3. Atualizar `index.html`:
   - `og:image` e `twitter:image` para a nova URL absoluta;
   - adicionar `og:image:width` (1200), `og:image:height` (630) e `og:image:alt`;
   - adicionar `og:url` e `og:site_name` com o domínio oficial;
   - remover `twitter:site` `@lovable_dev`.
4. Ajustar `src/components/SEOHead.tsx` para usar a mesma imagem absoluta como padrão (hoje o default é um caminho relativo, que crawlers não resolvem).

## Observação importante

O WhatsApp guarda cache do preview por link. Depois da publicação, o link antigo pode continuar mostrando a imagem antiga por algumas horas; compartilhar com um parâmetro novo (ex.: `showdelances.com/?v=2`) força a atualização imediata.

## Escopo

Somente metadados de `<head>` e o novo arquivo de imagem. Nenhuma mudança de UI, fluxo ou lógica de negócio.
