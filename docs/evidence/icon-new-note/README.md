# Nova nota e catálogo de ícones

Validação pelo navegador: nova nota abre em Escrever com ferramentas visíveis; inserir ícones preserva a edição visual. A galeria e o documento renderizam nomes com siglas e números (arrow-down-az, arrow-up-az, arrow-up-za e arrow-up01).

- [Editor visual no desktop](visual-icons-desktop.png)
- [Editor visual no celular](visual-icons-mobile.png)

Teste: `tests/icon-new-note.spec.ts`.

A sincronização por clique e a expansão ao entrar em Visão são verificadas em `tests/contextual-editing.spec.ts`, incluindo deslocar o painel oposto antes de clicar sem rolar o painel ativo.

- [Painéis alinhados por clique](../contextual-editing/click-aligned-split-desktop.png)
