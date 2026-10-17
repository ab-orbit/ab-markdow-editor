# AB Markdown

Powered by **Aeon Bridge Co.** — offered to community.

Editor Markdown extraído do Lab do AB-POLInSights, como aplicação web local independente para macOS (Apple Silicon e Intel). A pasta contém todo o código e pode ser distribuída sozinha em outro repositório. O Lab original não é alterado e não é necessário para instalar ou executar esta aplicação.

## Instalar no Mac

Baixe ou clone este repositório, abra o Terminal na pasta do editor e execute:

```bash
git clone https://github.com/ab-orbit/ab-markdow-editor.git
cd ab-markdow-editor
./install.sh
```

O instalador compila o editor, instala `~/Applications/AB Markdown.app`, cria um ícone na Mesa e abre o navegador padrão. O aplicativo inclui seu próprio runtime Node: depois da instalação, a pasta baixada pode ser movida ou removida. A primeira instalação precisa de internet. O instalador baixa a distribuição oficial do Node.js 22 LTS para a arquitetura do Mac, verifica SHA-256 e inclui o runtime completo no aplicativo, sem depender de Node/Homebrew/nvm já instalados. É necessário Git; se faltar, o macOS oferece instalar suas ferramentas de linha de comando e o instalador pede para ser executado novamente após essa instalação.

Abra **AB Markdown** na Mesa nas próximas vezes. O servidor escuta apenas em `127.0.0.1` numa porta livre, sem conta, API externa ou banco de dados. Fechar a aba mantém o servidor disponível para a próxima abertura.

## Escolher onde salvar

1. Abra a engrenagem **Configurações** na barra do editor. A configuração abre automaticamente no primeiro uso.
2. Clique **Selecionar pasta**. O seletor nativo do macOS permite escolher a pasta do repositório, que será conectada automaticamente. Também é possível digitar ou colar um caminho e usar **Conectar caminho**.
3. Para um repositório ainda não clonado, expanda **Clonar um repositório por URL**, informe a URL HTTPS/SSH e use **Selecionar onde clonar** para escolher a pasta de destino. Será criada uma subpasta com o nome do repositório, cujo caminho pode ser ajustado antes de clonar. O Git usa suas credenciais locais.
4. Escolha um Markdown em **Arquivos do repositório** ou clique **Novo**.
5. Informe um caminho relativo, por exemplo `pesquisa/contexto.md`, e clique **Salvar no repositório**.
6. Preencha a mensagem e clique **Criar commit**. Depois, **Enviar (push)** publica os commits pendentes da branch no remoto configurado.

Salvar grava o documento UTF-8 e suas imagens na cópia local. Commit e push são ações explícitas. O primeiro push de uma branch sem upstream deve ser configurado no Terminal com `git push -u origin NOME_DA_BRANCH`. A identidade Git (`user.name`/`user.email`) também deve estar configurada. A aplicação não coleta senhas nem configura autenticação: credenciais HTTPS, chave SSH e permissões remotas devem funcionar previamente no Terminal. Helpers que exigem interação podem precisar ser desbloqueados antes de abrir o app.

Ao abrir outro arquivo, criar um documento ou trocar de repositório, o editor pede confirmação se houver alterações pendentes. Se o arquivo for alterado fora do editor, salvar acusa conflito: reabra a versão atual ou escolha outro nome. Salvar com outro nome cria uma cópia; o original permanece.

## Editor

Depois de configurar o repositório, a tela mostra somente o editor. A engrenagem abre as configurações, os arquivos do repositório e as ações de Git em uma janela separada. O botão de salvar na barra e o atalho **⌘S** gravam o documento sem abrir as configurações. Fechar essa janela ou usar Escape preserva o texto e o histórico de edição.

Mantém os modos **Escrever**, **Fonte**, **Visão** e **Ler**, formatação, desfazer/refazer, tabelas editáveis, tarefas, referências, imagens por seleção/colagem/arrastar, importação de Markdown/ZIP/Bear e exportação `.md`/ZIP. Imagens inseridas são gravadas na pasta `assets/` ao lado do documento; imagens remotas não são buscadas automaticamente. Os temas claro e escuro usam uma cópia dos tokens do app original.

Limites: 5 MB de texto, 10 MB por imagem, 40 MB de imagens e 50 imagens por documento. O editor não executa HTML incorporado. Não aceita caminhos que escapem do repositório, links simbólicos ou alterações em `.git`. O commit recusa operar quando já há arquivos no stage para evitar misturar trabalho de outras ferramentas. Hooks Git continuam sendo respeitados.

## Desenvolvimento e testes

```bash
npm ci
npm run build
npm test
npm start # http://127.0.0.1:43127
npx playwright install chromium # somente para os testes de navegador
npm run test:e2e
```

O servidor de produção usa apenas módulos nativos do Node. A interface usa React, Vite, CodeMirror, react-markdown, remark-gfm, lucide e fflate. Nenhuma importação aponta para o monorepo.

Configurações e logs: `~/Library/Application Support/AB Markdown/` (`settings.json`, `runtime.json`, `server.log`). O caminho do repositório é lembrado entre sessões. O token da API é temporário, muda a cada processo e não é salvo no repositório. O editor precisa do processo local para ler e gravar arquivos; publicar apenas a pasta `dist` num site não dá acesso ao Git do usuário.

## Atualizar ou remover

Para atualizar, salve os documentos e execute `./install.sh` na nova versão. O instalador encerra o servidor anterior, substitui o aplicativo e abre a nova versão. Para encerrar o servidor manualmente, use `npm run stop` na pasta do código ou `"$HOME/Applications/AB Markdown.app/Contents/Resources/runtime/bin/node" "$HOME/Applications/AB Markdown.app/Contents/Resources/scripts/stop.mjs"`. Remova `~/Applications/AB Markdown.app` e o atalho da Mesa para desinstalar. A pasta de configurações pode ser removida separadamente; seus repositórios e documentos ficam preservados.

O bundle é gerado localmente, sem assinatura/notarização de distribuição. A evidência de validação desta extração está em [docs/VALIDATION.md](docs/VALIDATION.md).
