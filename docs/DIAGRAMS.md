# Diagramas no Scriba

Blocos Markdown identificados como `mermaid` são desenhados nos modos Ler, Visão e na prévia de Escrever. Fonte preserva o código literal. O seletor no canto superior do desenho permite comparar **Mermaid 12.2.0**, **Pele 1.6.0** e **Beautiful Mermaid 1.1.3**. A escolha é privada neste navegador, independente por documento/bloco e compartilhada entre os modos de visualização.

Abra [examples/diagramas.md](../examples/diagramas.md) para experimentar ER, fluxograma, sequência e cronograma. O botão de lápis revela o bloco original. Trocar o renderizador não altera o texto, o estado de edição ou o histórico Git.

Os motores têm cobertura e layouts diferentes. Beautiful Mermaid aceita um conjunto menor; blocos não suportados continuam mostrando o seletor e uma explicação. Um erro de sintaxe afeta somente o respectivo desenho.

## Lupa

O botão de lupa ao lado do seletor ativa uma lente de **2×**. Passe o mouse sobre o desenho para ampliar o detalhe sob o ponteiro. A lente acompanha o mouse, cabe na janela e desaparece ao sair do desenho. Clique novamente no botão ou pressione **Esc** para desativar.

No celular/tablet, ative a lupa e **arraste o dedo** pelo desenho; a lente aparece acima do dedo e desaparece ao soltá-lo. Desative a lupa para voltar a rolar sobre o diagrama normalmente. Pelo teclado, depois de ativar, use **Tab** até o desenho e as **setas** para explorar; **Shift + seta** move mais rápido.

A lente amplia uma cópia vetorial do SVG já produzido, com IDs isolados. O movimento usa `requestAnimationFrame`, sem executar novamente Mermaid/Pele/Beautiful e sem atualizar o texto ou seu histórico de edição. A ativação vale para o bloco visível e não fica persistida após reabrir a nota.

## Desempenho e apresentação

- Cada motor é carregado somente quando necessário. A PWA inclui os chunks emitidos no cache estático para uso offline após a instalação do cache.
- Há uma pausa de 120 ms para agrupar alterações do bloco, deduplicação de trabalho e cache LRU limitado a 24 desenhos/12 MB. Resultados de versões antigas do bloco são descartados pela interface.
- O indicador em milissegundos registra o tempo observado de desenho. Exclui a importação do módulo principal e a espera inicial por fontes; pode incluir imports internos do próprio motor. O tooltip identifica resultados reutilizados do cache. Isso não representa um benchmark controlado entre bibliotecas.
- Pele e Beautiful usam cores CSS do aplicativo. Mermaid recebe os tokens resolvidos e redesenha quando o tema muda.
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
