# Nota e Whiteboard — Scriba 1.14.0

O seletor **Nota | Whiteboard** abre um canvas infinito na própria área de trabalho. No celular, o formato fica no seletor da barra superior. Texto e desenhos continuam no mesmo Markdown; **+** acrescenta outro quadro, e o seletor permite alternar entre eles.

Os desenhos usam o salvamento, os rascunhos e o destino já configurados. A barra do whiteboard importa `.excalidraw` e exporta SVG, PNG transparente ou uma cena editável. Trocar de formato, navegar ou mover o canvas não reescreve a nota. Arquivos apenas com quadros abrem diretamente como whiteboard.

## Produção

Publicado em https://scriba.aeonbridge.app/ como **1.14.0**, commit `00d4f0b`. O HTML público corresponde byte a byte ao build validado. Release: `/var/www/scriba/releases/20261020T015237Z-public-1.14.0`.

Jornadas completas do whiteboard passaram no site público em [Chrome](whiteboard-production-chromium.txt) e [WebKit](whiteboard-production-webkit.txt). A confirmação de recarga passou em [quatro jornadas de produção](reload-production/verification.json), cobrindo cancelar, confirmar, preservar a origem e salvar novamente.

O aplicativo `/Applications/Scriba.app` também está na versão **1.14.0**, com backup prévio, assinatura verificada e build local confirmado pelo serviço em execução.

## Validação

- [Chrome](whiteboard-chromium.txt) e [WebKit](whiteboard-webkit.txt): desenho, texto por teclado/toque, salvamento com texto ativo, dois quadros, recarga, exportação e importação tardia após abrir outro arquivo. Ambos os temas, desktop, celular e tablet nas duas orientações.
- [Git real](whiteboard-git.txt): checkout e remoto bare temporários, Cmd+S, commit/push, Cmd+W com cancelar ou salvar e fechar. Texto original, BOM e CRLF preservados.
- [HTTP/Git](http-git.txt): 61 testes aprovados, nenhum erro.
- [Excalidraw existente](excalidraw-local.txt): 29 cenas, editor de bloco, edição natural, exportação e salvamento local. [Primeiro carregamento offline](excalidraw-offline.txt) também aprovado.
- Recarregamento de origem: [local/Git](reload-local.txt) e [navegador/pasta](reload-browser.txt) aprovados.

[Resultados estruturados](verification.json). Os testes usam documentos sintéticos e contextos isolados. WebKit e toque automatizado não equivalem a uma execução física no iPhone. O binário iOS em análise na Apple é uma distribuição separada.

## Evidências visuais

| Dispositivo | Claro | Escuro |
|---|---|---|
| Desktop, Chrome | [1440×900](whiteboard-light-1440x900-chrome.png) | [1440×900](whiteboard-dark-1440x900-chrome.png) |
| Celular, WebKit | [390×844](whiteboard-light-390x844-webkit.png) | [390×844](whiteboard-dark-390x844-webkit.png) |
| Celular horizontal, WebKit | [844×390](whiteboard-light-844x390-webkit.png) | [844×390](whiteboard-dark-844x390-webkit.png) |
| Tablet vertical, WebKit | [820×1180](whiteboard-light-820x1180-webkit.png) | [820×1180](whiteboard-dark-820x1180-webkit.png) |
| Tablet horizontal, WebKit | [1180×820](whiteboard-light-1180x820-webkit.png) | [1180×820](whiteboard-dark-1180x820-webkit.png) |
