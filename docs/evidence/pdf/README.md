# Exportação PDF — 1.15.0

A ação Exportar PDF gera o documento no dispositivo, sem salvar a nota ou enviá-la a um serviço. Papel A4 claro, texto selecionável com fontes incorporadas, hierarquia de títulos, listas, links, notas de referência, tabelas zebradas com cabeçalho repetido e imagens locais. Diagramas usam imagens em alta resolução para preservar o desenho e as fontes.

Todas as páginas incluem a logo pequena, **scriba markdown editor - powered by Aeon Bridge Co.** e a numeração. A preparação pode ser cancelada e o layout roda em um worker carregado somente ao exportar. Os recursos da geração são precacheados junto com a PWA.

- [Chrome](pdf-chromium.txt) e [WebKit](pdf-webkit.txt): arquivo A4 de cinco páginas, acentos, conteúdo selecionável, tabela longa, imagem, Mermaid e Excalidraw, logo/marca por página, cancelamento, fonte intacta e ausência de escritas ou requisições externas.
- [Primeiro uso offline](pdf-offline.txt): worker, fontes, imagens e renderizadores carregados do cache.
- Poppler verifica número de páginas, texto e imagens de rodapé. PNGs renderizados foram inspecionados para conferir paginação e leitura.

[PDF de exemplo](export-example.pdf) · [Página 1](page-1.png) · [Página 2](page-2.png) · [Menu no celular Chrome](pdf-export-menu-mobile-chrome.png) · [Menu no celular WebKit](pdf-export-menu-mobile-webkit.png).

A interface nativa iOS reaproveita o compartilhamento de arquivos já existente; o novo binário iOS não foi compilado ou enviado nesta publicação. WebKit automatizado não equivale a um teste físico no iPhone.

Fontes primárias: [pdfmake 0.3](https://pdfmake.github.io/docs/0.3/), [API de Blob](https://pdfmake.github.io/docs/0.3/getting-started/client-side/methods/). Dependência fixada em 0.3.12; licenças de pdfmake e Roboto distribuídas com o aplicativo.
