# Salvar como — 1.16.0

**Salvar como…** (⌘⇧S / Ctrl+Shift+S) permite escolher outro destino sem mudar o repositório configurado. O arquivo gravado vira o destino ativo de Salvar, do automático e do recarregamento. A barra mostra **Arquivo local · caminho**. Cancelar, perder acesso, falhar a gravação ou encontrar uma versão externa preserva a nota e o destino anteriores.

No Mac, NSSavePanel escolhe o Markdown e o servidor grava suas imagens ao lado dele. O seletor foi conferido na interface real e retornou o arquivo escolhido, com extensão .md e acentos. O acesso de escrita vem apenas dessa escolha explícita; a importação normal do Finder continua protegendo o original.

Na web com File System Access, o seletor é chamado dentro do gesto do usuário. O handle fica privado no IndexedDB, sem enviar notas ao servidor. Notas com imagens usam ZIP para levar a estrutura completa; um Markdown já vinculado que passe a conter imagens pede Salvar como em ZIP. Safari/iOS sem esse seletor oferece uma cópia para baixar/compartilhar e explica que o destino ativo permanece o mesmo.

## Verificação

- [HTTP/Git: 62 testes](http-git.txt), incluindo seleção privada de destino, rejeição de capacidades somente leitura, BOM/CRLF, imagens, conflitos e backup antes de substituir.
- [Mac / Chromium](local-chromium.txt) e [Mac / WebKit](local-webkit.txt): seleção simulada, escrita real em diretório temporário fora do checkout, ⌘S/Ctrl+S, restauração, recarga do disco, conflito/backup e Salvar e criar sem commit indevido. Nenhuma nota pessoal usada.
- [Navegador Chromium](browser-chromium.txt): seleção simulada com handle real de OPFS, ativação do usuário, cancelamento, falha, restauração pelo IndexedDB, conflito, cópia alternativa, ZIP com imagens e texto ativo de whiteboard incluído no salvamento.
- [Navegador WebKit](browser-webkit.txt): cópia com bytes exatos, nome escolhido e destino original preservado.
- [Seletor nativo real](native-picker.txt). Os testes automatizados de UI simulam somente a escolha do sistema; não equivalem a um teste físico no iPhone.
- Regressões: criar nova nota em Chromium; primeira exportação PDF totalmente offline. PDF e atalhos da versão 1.15.0 também foram conferidos em produção em Chromium/WebKit.

[Desktop Chromium](save-as-desktop-chrome.png) · [Celular Chromium](save-as-mobile-chrome.png) · [Desktop WebKit](save-as-desktop-webkit.png) · [Celular WebKit](save-as-mobile-webkit.png).

Referência primária: [File System Access — Chrome](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).
