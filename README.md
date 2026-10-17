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
6. O salvamento cria o commit e envia ao remoto automaticamente. Ative **Perguntar nota do commit a cada salvamento** nas configurações se quiser escrever a mensagem antes de salvar.

Salvar grava o documento UTF-8 e suas imagens, cria um commit apenas desses arquivos e faz push. Sem nota personalizada, usa `Update caminho/do/arquivo.md` (ou `Auto-save ...` no automático). Não cria commits vazios se nada mudou. O primeiro push de uma branch sem upstream usa `origin` e configura o acompanhamento automaticamente. A identidade Git (`user.name`/`user.email`) também deve estar configurada. A aplicação não coleta senhas nem configura autenticação: credenciais HTTPS, chave SSH e permissões remotas devem funcionar previamente no Terminal. Helpers que exigem interação podem precisar ser desbloqueados antes de abrir o app.

Ao abrir outro arquivo, criar um documento ou trocar de repositório, o editor pede confirmação se houver alterações pendentes. Ao importar um `.md` pelo seletor, o editor identifica a versão original e reconhece o arquivo já existente na pasta quando o conteúdo de origem coincide. A abertura pela lista do repositório também mantém a versão do disco. Se houver outra versão, a janela **Resolver versões do arquivo** mantém o texto da aba e permite **Salvar uma cópia**, **Continuar editando** ou **Substituir arquivo existente**. A substituição confirma novamente a versão atual e guarda um backup privado em `~/Library/Application Support/AB Markdown/conflict-backups/`; se o disco mudar outra vez antes da confirmação, a sobrescrita continua bloqueada. Salvar com outro nome cria uma cópia; o original permanece.

## Salvamento automático e notas de commit

Na engrenagem, abra **Salvamento e sincronização**:

- **Perguntar nota do commit a cada salvamento**: abre um diálogo antes de salvar, criar o commit e enviar. Vale para o botão, ⌘S e o salvamento automático. Cancelar não grava nem envia o documento.
- **Ativar salvamento automático**: grava, cria o commit e faz push enquanto a aba estiver aberta, quando houver alterações ou uma sincronização pendente.
- **Intervalo (minutos)**: padrão de **1 minuto**, configurável de 1 a 1440 minutos. Clique **Salvar preferências** para aplicar.

As duas opções vêm desativadas. As preferências ficam no Mac e sobrevivem ao fechamento do app, à troca de porta e à mudança de repositório. O automático pausa enquanto as configurações ou a nota estão abertas e não cria versões de um documento inicial intocado. Se a nota estiver ativada, cada ciclo com alterações aguarda sua confirmação.

Se o commit ou push falhar, o editor preserva a gravação local e mostra a etapa pendente. Salvar novamente tenta sincronizar usando a versão já gravada; uma falha de push não duplica o commit. O automático também tenta novamente no próximo intervalo. O Git continua respeitando hooks, identidade e credenciais locais; alterações já preparadas por outra ferramenta não entram no commit do editor. A execução do intervalo depende da aba aberta e pode ser adiada pelo navegador quando ela estiver suspensa.

## Editor

Depois de configurar o repositório, a tela mostra somente o editor. A engrenagem abre as configurações, os arquivos do repositório e as preferências de salvamento em uma janela separada. O botão de salvar na barra e o atalho **⌘S** gravam o documento sem abrir as configurações. Fechar essa janela ou usar Escape preserva o texto e o histórico de edição.

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

## Aplicativo PWA e ícone Escriba

O ícone representa um escriba egípcio nas cores do SPHINX: azul profundo, laranja e papiro claro. Ele aparece no favicon, no aplicativo do Mac e na instalação PWA.

Nas configurações, use **Instalar aplicativo** quando disponível; no Safari do Mac, **Arquivo → Adicionar ao Dock**. Depois do primeiro acesso, o editor abre offline e recupera automaticamente texto e imagens em rascunhos locais do navegador. A exportação também funciona offline. Para salvar no repositório e sincronizar Git, mantenha o serviço local aberto pelo ícone da Mesa; o push precisa de conexão ao remoto. O endereço local permanece em `http://127.0.0.1:43127`.

Veja [funcionamento e limites da PWA](docs/PWA.md) e [origem do ícone](docs/ICON.md).

## Notas recentes

A barra lateral lista as **100 notas Markdown mais recentemente alteradas** no repositório conectado, com nome, pasta e data. Clique para abrir; edições pendentes pedem confirmação antes da troca. O salvamento atualiza a ordem, e o botão de atualização relê mudanças feitas fora do editor. **Nova nota** inicia um documento. O botão **Notas** mostra ou recolhe a lista; no celular ela começa recolhida.

A logo aparece no cabeçalho do editor. Favicon e ícones PWA usam URLs novas para substituir versões antigas em cache. Em uma aba que já estava aberta durante a atualização, recarregue para carregar a interface nova; rascunhos são recuperados pelo navegador.

O layout usa a altura inteira da janela: lista e documento rolam separadamente. A lateral mostra o título Markdown, um trecho e a data da nota; nomes longos são limitados a duas linhas. A barra principal usa ícones com rótulos acessíveis. Clique em **T (Formatação)** para abrir ou recolher as ferramentas de edição. No celular, a lista abre sobre o documento e fecha ao escolher uma nota.
