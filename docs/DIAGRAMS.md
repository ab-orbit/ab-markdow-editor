# Diagramas no Scriba

Blocos Markdown identificados como `mermaid` são desenhados nos modos Ler, Visão e na prévia de Escrever. Fonte preserva o código literal. O seletor no canto superior do desenho permite comparar **Mermaid 12.2.0**, **Pele 1.6.0** e **Beautiful Mermaid 1.1.3**. A escolha é privada neste navegador, independente por documento/bloco e compartilhada entre os modos de visualização.

Abra [examples/diagramas.md](../examples/diagramas.md) para experimentar ER, fluxograma, sequência e cronograma. O botão de lápis revela o bloco original. Trocar o renderizador não altera o texto, o estado de edição ou o histórico Git.

Os motores têm cobertura e layouts diferentes. Beautiful Mermaid aceita um conjunto menor; blocos não suportados continuam mostrando o seletor e uma explicação. Um erro de sintaxe afeta somente o respectivo desenho.

## Lupa

O botão de lupa ao lado do seletor ativa uma lente de **2×**. Passe o mouse sobre o desenho para ampliar o detalhe sob o ponteiro. A lente acompanha o mouse, cabe na janela e desaparece ao sair do desenho. Clique novamente no botão ou pressione **Esc** para desativar.

No celular/tablet, ative a lupa e **arraste o dedo** pelo desenho; a lente aparece acima do dedo e desaparece ao soltá-lo. Desative a lupa para voltar a rolar sobre o diagrama normalmente. Pelo teclado, depois de ativar, use **Tab** até o desenho e as **setas** para explorar; **Shift + seta** move mais rápido.

A lente amplia uma cópia vetorial do SVG já produzido, com IDs isolados. O movimento usa `requestAnimationFrame`, sem executar novamente Mermaid/Pele/Beautiful/ZenUML e sem atualizar o texto ou seu histórico de edição. A ativação vale para o bloco visível e não fica persistida após reabrir a nota.

## Desempenho e apresentação

**Zoom e exportação.** A roda do mouse e os botões −/+ ampliam o SVG existente de 100% a 600%; o ponto sob o mouse fica como referência. Arraste para navegar, ou use o toque na área ampliada. Clique no percentual para ajustar à largura; no teclado da área de zoom, use +, − e 0. Não há chamada ao motor durante o zoom. **Ver código** abre um painel de fundo distinto com gramática Mermaid do Shiki, carregada sob demanda e colorida pelos tokens dos dois temas. **Copiar** copia o conteúdo Mermaid. **Baixar diagrama** permite escolher SVG ou PNG transparente. A exportação incorpora os estilos resolvidos do motor atual e usa o desenho completo, sem recortar o zoom; o PNG usa até 2× a resolução vetorial, limitado a 8192 px por lado e 16 milhões de pixels para caber na memória do celular. Tudo é gerado no próprio dispositivo.

- Cada motor é carregado somente quando necessário. A PWA inclui os chunks emitidos no cache estático para uso offline após a instalação do cache.
- Há uma pausa de 120 ms para agrupar alterações do bloco, deduplicação de trabalho e cache LRU limitado a 24 desenhos/12 MB. Resultados de versões antigas do bloco são descartados pela interface.
- O indicador em milissegundos registra o tempo observado de desenho. Exclui a importação do módulo principal e a espera inicial por fontes; pode incluir imports internos do próprio motor. O tooltip identifica resultados reutilizados do cache. Isso não representa um benchmark controlado entre bibliotecas.
- Pele, Beautiful e ZenUML usam cores CSS do aplicativo. Mermaid recebe os tokens resolvidos e redesenha quando o tema muda.
- O SVG permanece vetorial e mantém sua proporção; a prévia normal respeita o tamanho natural e a lupa amplia somente a região inspecionada. Controles têm alvo de toque de 44 px em telas de até 1024 px e dispositivos com ponteiro de toque.
- SVGs têm estilos e IDs isolados. Fontes externas, imagens externas e links do desenho são removidos; Markdown HTML continua desativado.
- A renderização Mermaid usa modo estrito. O texto de um bloco é limitado a 50 mil caracteres, e o resultado SVG a 4 milhões. Blocos grandes devem ser divididos.

Mermaid 12 exige Safari 17.4 ou superior. A cobertura de navegador e as capturas desta implementação estão em [DIAGRAMS.md de evidências](evidence/DIAGRAMS.md). Isso não certifica todas as opções de todas as gramáticas Mermaid.

## Testes

```bash
npm run build
node tests/diagrams.smoke.mjs
MARKDOWN_BROWSER=webkit node tests/diagrams.smoke.mjs
VITE_STORAGE_MODE=browser npm run build
node tests/diagrams-browser.smoke.mjs
```

O smoke usa repositório e remoto Git temporários. Verifica os três motores reais, ER/fluxograma, troca e persistência por bloco, duplicatas/IDs, recuperação de erro, modos de leitura/escrita/fonte, exportação fiel, temas e tamanhos de celular/tablet. Não toca nos documentos do usuário.

## ZenUML

`@zenuml/core` 4.7.2 é carregado sob demanda para cercas `zenuml` ou cercas `mermaid` iniciadas por `zenuml`. Usa `validate` da API pública do parser e `renderToSvg`, sem iframe ou serviço externo. O adaptador mantém SVG nativo, fonte IBM Plex Sans local, ícones embutidos, cores por tokens e os controles compartilhados. A fonte é incorporada à exportação para preservar as medidas de texto fora do aplicativo. As licenças MIT do ZenUML e SIL OFL da IBM Plex estão em `public/licenses/`.

ZenUML tem uma sintaxe própria de sequência; o seletor dos outros três motores permanece para a gramática Mermaid. A biblioteca também oferece uma interface HTML cujo stylesheet global é injetado por seu pacote ESM. O plugin `scriba-zenuml-svg-only` no Vite remove esse primeiro injetor e preserva o namespace do catálogo cloud diante da otimização de imports do Vite, com validação explícita do formato da dependência fixada. A saída SVG mantém seu sanitizador e estilos isolados. Ao atualizar a versão, revise essa condição antes de publicar.

O [manual existente](Scriba-Diagramas.md) inclui 25 exemplos ZenUML e um catálogo de 513 anotações cloud/infraestrutura, além de papéis UML e atalhos. A extensão de um manual instalado acrescenta a seção uma única vez, sem substituir bytes anteriores, repinar a nota ou restaurar arquivos removidos. O marcador de migração respeita remoções posteriores da seção.

```sh
node tests/zenuml.smoke.mjs
MARKDOWN_BROWSER=webkit node tests/zenuml.smoke.mjs
VITE_STORAGE_MODE=browser npm run build
SCRIBA_BROWSER_MODE=1 node tests/zenuml.smoke.mjs
SCRIBA_BROWSER_MODE=1 MARKDOWN_BROWSER=webkit node tests/zenuml.smoke.mjs
```

Veja [evidências e limitações](evidence/zenuml/README.md).
