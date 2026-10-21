# Barra de ações e exportação

- Salvar como fica imediatamente após Salvar.
- Índice fica imediatamente antes do seletor de tema.
- Exportar oferece Markdown e PDF em um único menu.
- Markdown sem anexos baixa como `.md`; com imagens anexadas, baixa ZIP com `text.md` e os assets nos caminhos referenciados pela nota.

Validação: `tests/export-menu.spec.ts` confere o conteúdo do Markdown, os bytes das imagens no ZIP, as opções e os limites do menu no celular. `tests/import-conflict.spec.ts` confere a posição de Salvar como com um repositório conectado.

[Desktop](unified-export-desktop.png) · [Celular](unified-export-mobile.png)
