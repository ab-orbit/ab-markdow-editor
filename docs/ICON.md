# Ícone Escriba

Símbolo reduzido a dois elementos: perfil egípcio em marfim e cálamo laranja, sobre azul profundo do SPHINX. A composição anterior com corpo inteiro não funcionava na linha de 16 px do Finder. Esta versão elimina corpo, mãos e papiro para preservar a leitura de perfil e ferramenta de escrita em tamanho pequeno.

Arte gerada com OpenAI ImageGen. Fonte: [scribe-source.png](../public/icons/scribe-source.png). Reduções conferidas em 16 e 32 px antes de atualizar o Mac.

Prompt utilizado:

> Create an ultra-simple app logo designed FIRST for 16 by 16 pixels. Square solid midnight navy background #102231. Exactly TWO huge contrasting graphic elements: on the LEFT, one solid IVORY #f1eee5 ancient Egyptian human HEAD PROFILE facing right with a flat-topped Egyptian bob wig, angular prominent nose and chin; on the RIGHT, one thick ORANGE #ff7a18 REED PEN tilted diagonally with a pointed writing tip. Head occupies 60 percent of square width and 85 percent of square height. Orange pen occupies remaining 25 percent width and 80 percent height. Shapes almost fill the square, only 6 percent outer margin. The head is a single unbroken ivory silhouette with no internal details. This is a contemporary Egyptian scribe emblem reduced to profile plus writing tool. Strict flat vector geometry, only ivory and orange on navy. NO BODY, no hands, no paper, no scroll, no sitting person, no eyes, no face lines, no hair stripes, no gradients, no shadows, no texture, no letters, no text, no frame. Extremely bold silhouette with broad features and clear negative space. Make it readable at favicon size. Deliver just the square logo.

`npm run icons` deriva PNGs de 16 a 1024 px, variantes maskable, Apple Touch Icon e favicon. O instalador gera o `.icns` e o aplica ao aplicativo e ao alias nativo da Mesa.
