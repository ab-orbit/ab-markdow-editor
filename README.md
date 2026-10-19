# AB Markdown

Powered by **Aeon Bridge Co.** — offered to community.

Scriba também tem uma versão pública em [scriba.aeonbridge.app](https://scriba.aeonbridge.app/), com notas privadas por navegador. A [versão nativa para iPhone e iPad](docs/app-store/README.md) inclui o editor offline, seleção de pasta em Arquivos, compartilhamento do sistema e GitHub opcional; a distribuição pela App Store está em preparação.

Editor Markdown extraído do Lab do AB-POLInSights, como aplicação web local independente para macOS (Apple Silicon e Intel). A pasta contém todo o código e pode ser distribuída sozinha em outro repositório. O Lab original não é alterado e não é necessário para instalar ou executar esta aplicação.

## Instalar no Mac

Baixe ou clone este repositório, abra o Terminal na pasta do editor e execute:

```bash
git clone https://github.com/ab-orbit/ab-markdow-editor.git
cd ab-markdow-editor
./install.sh
```

O instalador compila o editor, instala `Scriba.app` em `/Applications` (ou `~/Applications`, sem acesso à pasta global), cria um ícone na Mesa e abre o navegador padrão. O aplicativo inclui seu próprio runtime Node: depois da instalação, a pasta baixada pode ser movida ou removida. A primeira instalação precisa de internet. O instalador baixa a distribuição oficial do Node.js 22 LTS para a arquitetura do Mac, verifica SHA-256 e inclui o runtime completo no aplicativo, sem depender de Node/Homebrew/nvm já instalados. É necessário Git; se faltar, o macOS oferece instalar suas ferramentas de linha de comando e o instalador pede para ser executado novamente após essa instalação.

Abra **Scriba** na Mesa nas próximas vezes. O servidor escuta apenas em `127.0.0.1` numa porta livre, sem conta, API externa ou banco de dados. Fechar a aba mantém o servidor disponível para a próxima abertura.

## Escolher onde salvar

1. Abra a engrenagem **Configurações** na barra do editor. A configuração abre automaticamente no primeiro uso.
2. Clique **Selecionar pasta**. O seletor nativo do macOS permite escolher a pasta do repositório, que será conectada automaticamente. Também é possível digitar ou colar um caminho e usar **Conectar caminho**.
3. Para um repositório ainda não clonado, expanda **Clonar um repositório por URL**, informe a URL HTTPS/SSH e use **Selecionar onde clonar** para escolher a pasta de destino. Será criada uma subpasta com o nome do repositório, cujo caminho pode ser ajustado antes de clonar. O Git usa suas credenciais locais.
4. Escolha um Markdown em **Arquivos do repositório** ou clique **Novo**.
5. Informe um caminho relativo, por exemplo `pesquisa/contexto.md`, e clique **Salvar no repositório**.
6. O salvamento cria o commit e envia ao remoto automaticamente. Ative **Perguntar nota do commit a cada salvamento** nas configurações se quiser escrever a mensagem antes de salvar.

Salvar grava o documento UTF-8 e suas imagens, cria um commit apenas desses arquivos e faz push. Sem nota personalizada, usa `Update caminho/do/arquivo.md` (ou `Auto-save ...` no automático). Não cria commits vazios se nada mudou. O primeiro push de uma branch sem upstream usa `origin` e configura o acompanhamento automaticamente. A identidade Git (`user.name`/`user.email`) também deve estar configurada. A aplicação não coleta senhas nem configura autenticação: credenciais HTTPS, chave SSH e permissões remotas devem funcionar previamente no Terminal. Helpers que exigem interação podem precisar ser desbloqueados antes de abrir o app.

Ao abrir outro arquivo, criar um documento ou trocar de repositório, o editor pede confirmação se houver alterações pendentes. Ao importar um `.md` pelo seletor, o editor identifica a versão original e reconhece o arquivo já existente na pasta quando o conteúdo de origem coincide. A abertura pela lista do repositório também mantém a versão do disco. Se houver outra versão, a janela **Resolver versões do arquivo** mantém o texto da aba e permite **Salvar uma cópia**, **Continuar editando** ou **Substituir arquivo existente**. A substituição confirma novamente a versão atual e guarda um backup privado em `~/Library/Application Support/AB Markdown/conflict-backups/`; se o disco mudar outra vez antes da confirmação, a sobrescrita continua bloqueada. Salvar com outro nome cria uma cópia; o original permanece.

## Alterações externas e recarregar a nota

A barra inclui **Recarregar do disco** no Mac e nas pastas autorizadas, **Recarregar do GitHub** no destino remoto ou **Recarregar nota** no armazenamento do navegador. O botão busca novamente o texto e as imagens da origem, mantendo o modo atual e a posição de leitura. Não faz commit nem push.

Arquivos importados pelo seletor, incluindo **⌘O**, ficam em memória sem um caminho reutilizável para o original. Neles, **Recarregar do disco** abre o seletor para escolher novamente o mesmo arquivo. O nome é verificado, edições pendentes exigem confirmação e o modo atual é preservado; ao terminar, aparece **Arquivo relido do disco**. Cancelar mantém a nota intacta. Depois de salvar no destino configurado, a releitura passa a usar esse destino diretamente. Notas abertas pela lista ou pelo **Abrir com Scriba** do Finder são relidas diretamente desde a abertura. Botões indisponíveis explicam o motivo no título e não exibem cursor de carregamento.

O arquivo aberto é verificado a cada **5 segundos** no disco/navegador e a cada **1 minuto** no GitHub, também ao voltar à janela. Sem edições pendentes, uma versão diferente é carregada automaticamente. Se houver texto, imagens ou envio offline pendentes, o Scriba mantém o rascunho, mostra um aviso e pausa o salvamento automático dessa nota. Recarregar pede confirmação antes de descartar o rascunho. Se a origem for removida, o documento continua em memória.

Arquivos externos abertos pelo Finder podem ser relidos da pasta original; salvar continua usando o destino configurado. A verificação depende da aba aberta e visível: o sistema pode suspender o aplicativo em segundo plano. Na versão local, alterações do GitHub chegam ao disco por seu fluxo Git habitual; a verificação não executa `pull` automaticamente.

## Salvamento automático e notas de commit

Na engrenagem, abra **Salvamento e sincronização**:

- **Perguntar nota do commit a cada salvamento**: abre um diálogo antes de salvar, criar o commit e enviar. Vale para o botão, ⌘S e o salvamento automático. Cancelar não grava nem envia o documento.
- **Ativar salvamento automático**: grava, cria o commit e faz push enquanto a aba estiver aberta, quando houver alterações ou uma sincronização pendente.
- **Intervalo (minutos)**: padrão de **1 minuto**, configurável de 1 a 1440 minutos. Clique **Salvar preferências** para aplicar.

As duas opções vêm desativadas. As preferências ficam no Mac e sobrevivem ao fechamento do app, à troca de porta e à mudança de repositório. O automático pausa enquanto as configurações ou a nota estão abertas e não cria versões de um documento inicial intocado. Se a nota estiver ativada, cada ciclo com alterações aguarda sua confirmação.

Se o commit ou push falhar, o editor preserva a gravação local e mostra a etapa pendente. Salvar novamente tenta sincronizar usando a versão já gravada; uma falha de push não duplica o commit. O automático também tenta novamente no próximo intervalo. O Git continua respeitando hooks, identidade e credenciais locais; alterações já preparadas por outra ferramenta não entram no commit do editor. A execução do intervalo depende da aba aberta e pode ser adiada pelo navegador quando ela estiver suspensa.

Antes de enviar, o Scriba busca as atualizações remotas. Quando a pasta está limpa, incorpora os commits recebidos por avanço direto ou merge, preservando o histórico dos dois lados. Se outro dispositivo publicar durante o envio, há uma nova tentativa de integração. Alterações locais ainda sem commit e operações Git em andamento interrompem essa integração. Quando a mesma nota tem alterações incompatíveis, o editor informa os arquivos em conflito e cancela apenas o merge que acabou de iniciar; as versões local e remota ficam preservadas para revisão na pasta do repositório.

Nas configurações do repositório local, o check verde **Pasta conectada** confirma o acesso à pasta selecionada. O resultado do envio ao remoto aparece junto ao botão de sincronização. O ícone **Sincronizar repositório**, ao lado das alterações, cria um commit com todos os arquivos pendentes da pasta e faz push. Ele também tenta enviar commits já criados quando um push anterior falhou, sem duplicá-los. Respeita a preferência de perguntar a nota do commit, os arquivos ignorados pelo Git e as alterações preparadas por outras ferramentas. A ação usa os arquivos já gravados no disco; o botão Salvar do editor grava o documento em edição.

## Desconectar, trocar e levar a estrutura local

Na engrenagem, abra o repositório conectado:

- **Desconectar** desativa o destino no Scriba, preservando a pasta, o histórico Git e o documento aberto. A pasta anterior fica disponível para reconectar, inclusive depois de fechar o aplicativo.
- **Trocar repositório** oferece outra pasta já clonada, **Clonar outra URL** ou **Outra URL, mantendo esta pasta**. A última opção mantém o histórico e os arquivos locais; se o novo remoto tiver um histórico incompatível, use a clonagem e a cópia da estrutura.
- **Levar notas, imagens e subpastas atuais** copia os arquivos já gravados. A revisão mostra destino, branch e quantidade antes de aplicar. Arquivos diferentes com o mesmo nome bloqueiam a transferência; **Usar subpasta** preserva as duas estruturas e os caminhos relativos das imagens. Os originais não são removidos. O diretório `.git`, arquivos ignorados pelo Git, links simbólicos e submódulos não são copiados; o histórico do destino é preservado.
- **Criar commit e enviar ao remoto** controla o envio da transferência e respeita a preferência de mensagem de commit. Falhas de push preservam os arquivos copiados e o commit local; o botão de sincronização permite tentar novamente.

Cancelar a revisão mantém a conexão anterior. Um clone solicitado na revisão fica na nova pasta e pode ser reutilizado. Se escolher trocar sem levar a estrutura, o documento aberto continua no editor com o automático pausado até salvá-lo manualmente ou abrir outra nota. Alterações na origem ou no destino depois da revisão exigem uma nova revisão.

## Edição por bloco e abertura em leitura

**Editar nota** no celular e **Escrever** no desktop permitem editar diretamente o texto formatado: títulos, parágrafos, listas, negrito e células de tabelas. **Concluir edição** volta à leitura. As ferramentas de formatação atuam sobre a seleção visual; desfazer/refazer, imagens e o salvamento habitual continuam disponíveis. Diagramas mantêm o desenho e seu lápis abre o código daquele bloco. **Fonte** continua mostrando o Markdown completo.

A edição visual carrega sob demanda. O arquivo salvo continua sendo Markdown: trechos não alterados preservam o texto original, referências, comentários, cercas de código e convenção de quebras de linha. Abrir e concluir a edição sem digitar não modifica o documento.

Arquivos abrem em **Ler**, incluindo notas do repositório, arquivos importados e documentos do Finder. **Nova nota** começa em **Escrever**.

- Dê **dois cliques** num título ou parágrafo para revelar e selecionar o Markdown daquele bloco. Os demais blocos mantêm sua formatação.
- No editor de bloco, um clique dentro de negrito, itálico, código inline ou tachado revela apenas os marcadores desse trecho. O duplo clique revela todos os marcadores do bloco, inclusive quando o parágrafo ocupa várias linhas. Na edição visual, o duplo clique seleciona palavras normalmente.
- **Esc** conclui a edição do bloco. Se entrou a partir de Ler, volta à leitura. Clicar em outro bloco encerra a exibição completa dos marcadores anteriores.
- Pelo teclado, use **Enter** em um bloco focado na leitura ou **⌘/Ctrl+Enter** no editor. A barra de formatação também oferece **Editar bloco como Markdown** / **Concluir edição do bloco**.
- **Editar blocos com duplo clique**, nas configurações, vem ativado e pode ser desligado. As alternativas de teclado continuam disponíveis. **Fonte** mantém o documento completo em Markdown e a seleção normal de palavras.

Revelar marcadores altera só a apresentação. O texto continua sob o mesmo histórico de desfazer/refazer; salvar mantém o fluxo configurado de gravação, commit e push.

## Atalhos para arquivos

- **⌘O** abre o seletor de Markdown/ZIP do sistema. O arquivo abre em **Ler**.
- **⌘S** salva no destino ativo e mantém o fluxo de commit/push e a preferência de mensagem de commit.
- **⌘W**, quando o navegador entrega esse atalho ao Scriba, fecha a nota atual. Com alterações ou sincronização pendente, oferece **Salvar e fechar**, **Fechar sem salvar** e **Cancelar**. O **× ao lado do nome do arquivo** executa a mesma ação e está sempre disponível na barra da nota. No celular, expanda **Mais opções da nota** para exibir a barra.

Salvar e fechar aguarda a gravação e a sincronização completas. Cancelar a mensagem de commit, encontrar um conflito ou falhar no envio mantém a nota aberta. Fechar uma nota não remove o arquivo salvo. O estado sem nota aberta também é preservado ao reabrir a página. No Windows/Linux, use **Ctrl** em vez de ⌘.

**Fechar a aba é uma ação do navegador:** Chrome/Safari podem reservar ⌘W e não entregar o evento à página. Nesse caso, o navegador oferece seu aviso padrão de sair/permanecer quando existem alterações; ele não permite trocar esse aviso por um diálogo com salvamento assíncrono. Cancele a saída e use ⌘S ou o × da nota para concluir o salvamento antes de sair. O Scriba continua protegendo o rascunho no navegador. Referências: [atalhos reservados e Keyboard Lock](https://developer.chrome.com/docs/capabilities/web-apis/keyboard-lock), [beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).

## Editor

Depois de configurar o repositório, a tela mostra somente o editor. A engrenagem abre uma página de configurações com o destino e as preferências de salvamento. O botão de salvar na barra e o atalho **⌘S** gravam o documento sem abrir as configurações. O botão Editor volta ao documento preservando o texto e o histórico de edição.

Mantém os modos **Escrever**, **Fonte**, **Visão** e **Ler**, formatação, desfazer/refazer, tabelas editáveis, tarefas, referências, imagens por seleção/colagem/arrastar, importação de Markdown/ZIP/Bear e exportação `.md`/ZIP. Imagens inseridas são gravadas na pasta `assets/` ao lado do documento; imagens remotas não são buscadas automaticamente. Os temas claro e escuro usam uma cópia dos tokens do app original.

O rodapé mostra palavras e caracteres totais. Ao selecionar texto, acrescenta **N selecionados**, incluindo espaços e quebras de linha. Na leitura e edição visual, conta o texto exibido; em Fonte e no editor de bloco, conta o Markdown selecionado. A contagem desaparece ao desfazer a seleção. No celular em leitura, a barra aparece durante a seleção. Veja a [validação com capturas](docs/evidence/SELECTION-STATISTICS.md).

A leitura usa Avenir Next quando disponível, com alternativas locais do sistema, texto de 14 px no celular/tablet estreito e 15 px no desktop, entrelinha de 1,75 e parágrafos justificados. Títulos, listas e células mantêm seus próprios alinhamentos. As tabelas preservam a largura útil das colunas e rolam horizontalmente por toque ou teclado, com a barra de rolagem oculta e linhas alternadas discretas nos dois temas. Campos e a edição visual no celular usam pelo menos 16 px.

Limites: 5 MB de texto, 10 MB por imagem, 40 MB de imagens e 50 imagens por documento. O editor não executa HTML incorporado. Não aceita caminhos que escapem do repositório, links simbólicos ou alterações em `.git`. O commit recusa operar quando já há arquivos no stage para evitar misturar trabalho de outras ferramentas. Hooks Git continuam sendo respeitados.

## Índice da nota (outline)

O ícone de estrutura na barra da nota abre o índice dos títulos de níveis **#**, **##** e **###**, com recuo por nível e destaque da seção atual. Clique em uma seção para navegar sem mudar o modo de edição. O índice acompanha alterações nos títulos e ignora marcadores dentro de código e comentários. No desktop ele ocupa uma faixa lateral recolhível; no celular e tablet estreito, abre sobre a leitura e fecha após a navegação. Escape fecha o índice quando ele está em foco.

Veja [capturas e validação](docs/evidence/outline/README.md).

## Diagramas

Blocos **`excalidraw`** mostram cenas do **Excalidraw 0.18.1** com edição visual dentro da nota. Use o lápis ou dois cliques para abrir a prancheta; **Aplicar à nota** atualiza somente o bloco. Para criar, abra **Formatação → Inserir desenho Excalidraw**. Importe e baixe arquivos `.excalidraw`, veja/copie o JSON destacado e exporte SVG com fontes incorporadas ou PNG transparente. Os desenhos mantêm zoom, pan e lupa na prévia; cenas largas preservam o tamanho dos rótulos com navegação horizontal. O seletor dos três motores Mermaid continua independente.

A prancheta oferece formas, texto, setas vinculadas e cotoveladas, desenho livre, grupos, frames, alinhamento, camadas, grade, bibliotecas e imagens locais. Rascunhos e biblioteca ficam em IndexedDB neste navegador; uma recarga permite recuperar o desenho em andamento. O conteúdo aplicado segue o destino normal da nota, incluindo GitHub. SDK e fontes são locais e entram no cache offline. As [29 cenas contextualizadas](docs/Scriba-Diagramas.md#excalidraw-raciocinar-com-desenhos-editáveis) exploram essas ferramentas em processos, arquitetura, wireframes, análise e workshops. [Integração e limites](docs/research/excalidraw/README.md).

Blocos de código `mermaid` viram diagramas em **Ler**, **Visão** e na prévia de **Escrever**. Sobre cada desenho, o seletor permite alternar entre **Mermaid**, **Pele** e **Beautiful Mermaid** para comparar a apresentação. A escolha é independente por bloco e fica neste navegador; o arquivo Markdown permanece intacto. O lápis revela o código original.

Blocos **`zenuml`** e blocos **`mermaid` iniciados por `zenuml`** usam automaticamente **@zenuml/core 4.7.2**, com SVG nativo, numeração de mensagens, fonte local e ícones vetoriais cloud. As licenças distribuídas estão em `public/licenses/`. É uma linguagem própria de sequência. O motor compartilha zoom, lupa, código, cópia e exportação; não converte automaticamente `sequenceDiagram` para ZenUML. A [seção dedicada do manual](docs/Scriba-Diagramas.md#zenuml--interações-descritas-como-código) apresenta chamadas, eventos, retornos, grupos, criação, condições, laços, concorrência, regiões críticas e exceções. Veja a [validação no navegador](docs/evidence/zenuml/README.md).

Pele é o padrão ao carregar diagramas sem uma escolha salva. O seletor mantém Mermaid, Pele e Beautiful Mermaid; escolhas explícitas por bloco continuam valendo. Beautiful Mermaid tem cobertura menor e avisa quando o tipo não é suportado, mantendo o seletor disponível. Os três funcionam offline depois que a PWA conclui seu cache. Veja [exemplos](examples/diagramas.md), [detalhes](docs/DIAGRAMS.md) e [capturas/testes](docs/evidence/DIAGRAMS.md).

O botão **Lupa** amplia em **2×** a região sob o mouse sem redesenhar o diagrama. No toque, arraste o dedo; no teclado, use Tab e as setas. **Esc** ou o mesmo botão desativa a lupa. Funciona em Mermaid, Pele, Beautiful Mermaid e ZenUML, em Ler, Visão e Escrever.

A **roda do mouse** amplia o desenho de 100% a 600%, mantendo o ponto sob o ponteiro. Arraste para navegar; **−**, **+** e o percentual oferecem os mesmos controles por toque/teclado. Clique no percentual para ajustar à largura. O zoom reutiliza o SVG existente. **Ver código** abre um painel com destaque de sintaxe Mermaid ou ZenUML, fundo distinto e **Copiar**. O botão **Baixar diagrama** oferece **SVG vetorial** ou **PNG transparente**: exporta o desenho inteiro, com o estilo do renderizador escolhido, independentemente do zoom. Essas ações não alteram nem salvam a nota. Veja as [capturas e a validação](docs/evidence/reading-experience/README.md).


## Desenvolvimento e testes

```bash
npm ci
npm run build
npm test
npm start # http://127.0.0.1:43127
npx playwright install chromium # somente para os testes de navegador
npm run test:e2e
```

O servidor de produção usa apenas módulos nativos do Node. A interface usa React, Vite, CodeMirror, Tiptap/ProseMirror, react-markdown, remark-gfm, lucide e fflate. Nenhuma importação aponta para o monorepo.

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

A faixa superior foi removida: o documento e a lateral começam no topo da janela. O controle **Notas recentes** fica na barra do editor. A busca na lateral filtra as 100 notas carregadas por título, trecho e caminho do arquivo, sem diferenciar maiúsculas ou acentos. Limpar a busca restaura a lista; ela não pesquisa o conteúdo completo de todas as notas do repositório.

## Notas fixadas, períodos e leitura

As notas são agrupadas em **Fixadas**, **Hoje**, **Ontem**, **Últimos 7 dias** e **Mais antigas**. Datas aparecem como “agora”, “há 2 h”, “ontem” ou uma data curta; a data completa fica na dica ao passar o ponteiro. O alfinete aparece ao passar o ponteiro ou focar a linha pelo teclado, e permanece disponível em telas de toque.

A lista contém até 100 notas recentes **além das fixadas**. A ordem de fixação é lembrada no Mac por repositório (`library.json` em Application Support). Fixar ou desafixar não altera o Markdown nem faz commit.

Na primeira abertura de cada repositório, o editor inclui e fixa **AB-Markdown-Guia.md**, com apresentação, funcionalidades e roadmap. A criação tenta commit/push automaticamente; se não conseguir, o arquivo local permanece e o editor informa a falha. Arquivos já existentes nunca são substituídos: outro nome é escolhido. A nota pode ser editada e desafixada como qualquer outra. O [conteúdo do guia](server/guide.md) também está neste repositório.

O roadmap prevê Google Drive e novas opções de temas, sem datas anunciadas. A troca entre claro e escuro está disponível no botão de tema da barra de ferramentas. A leitura usa fonte de sistema sem serifa e cores suaves; código e modo Fonte continuam monoespaçados.

O guia inicial inclui uma ilustração de boas-vindas salva em `assets/escriba-welcome-v1.jpg`. Ela aparece no documento e como miniatura na lista. Outras notas também exibem a primeira imagem local encontrada nos primeiros 8 KB de Markdown. As miniaturas carregam quando entram na área visível, pela API local autenticada; imagens externas e SVG não são buscados/executados. Ao atualizar um guia já criado, o editor insere a imagem uma única vez, preserva o restante do conteúdo e sincroniza Markdown + JPG no Git.

## Celular e tablet

O modo Visão mantém texto e prévia na tela, com rolagem independente, em coluna nas telas estreitas e lado a lado nas maiores. A interface acompanha a altura disponível, mantém alvos de toque de 44 px e preserva o texto ao girar a tela. Confira a [matriz de testes responsivos e seus limites](docs/RESPONSIVE.md).

## Public Scriba PWA

Use **https://scriba.aeonbridge.app/** without installing a local server. By default, notes and images stay private in that browser's IndexedDB, including offline use after the first load. Export ZIP backups: clearing site data deletes local notes, and devices do not synchronize automatically.

The Mac application retains local Git save/commit/push. The public app also supports GitHub synchronization per user; Google Drive and additional themes remain planned.

Build the public version with `VITE_STORAGE_MODE=browser npm run build`. See [production deployment](docs/PRODUCTION.md).

### Open Markdown from Finder

The macOS installer registers AB Markdown as an alternate editor for `.md`, `.markdown`, and `.mdown`. Right-click a file → Open With → AB Markdown. To make it the default, use Get Info → Open with → AB Markdown → Change All. Installation does not replace your current default editor.

The native launcher receives Finder document events and imports the selected Markdown with safe local raster attachments. Files inside the currently configured Git checkout retain their relative path and revision. Files outside it are imported; saving uses the configured checkout and preserves the source file. The public PWA's OS file associations are separate from this macOS application registration.

## GitHub on web, iPhone and iPad

In Settings → GitHub, connect an account, choose an existing repository and the notes folder (`scriba` by default). Saving commits the Markdown and its images together. Browser-only notes and the Mac's local Git repository remain alternatives. Offline changes stay private on the device until saved online; automatic saving works while the note is open.

The account login button requires one-time activation of the organization's GitHub App. A repository-limited fine-grained token can also be used. See [authentication, deployment and conflict handling](docs/GITHUB.md).

## Contextual diagram reference

[Scriba — Manual contextual de diagramas](docs/Scriba-Diagramas.md) is the canonical, versioned Portuguese reference: 58 original examples across 33 Mermaid families (including the `info` diagnostic), plus 25 ZenUML sequence examples, a catalog of 513 cloud/infrastructure annotation keys and 29 editable Excalidraw scenes, with a question, interpretation, adaptation advice and measured compatibility for each example. The manual covers processes, state, data models, C4 architecture, planning, quantitative charts and analytical frameworks.

Version 1.8 adds an editable pinned copy beside the platform guide, including existing libraries. Browser storage, selected GitHub destinations and the Mac Git checkout each receive their own copy once. Existing unrelated filenames get a numbered alternative; copied references are adopted. Later edits, unpinning and deletion are respected. Local-only repository switches do not trigger an automatic commit or push. The macOS installer includes the canonical source so seeding works offline.

The reference's Unicode index links navigate inside the note. Compare engines, reveal the original source and use the existing magnifier on each drawing. Compatibility is limited to the tested examples, not a guarantee for every grammar combination. [Browser-rendering evidence](docs/evidence/diagram-reference/README.md) records the exact versions and results.

Validation: `npm test`; local build followed by `node tests/diagram-reference.smoke.mjs`; public build followed by `node tests/diagram-reference-browser.smoke.mjs`. The browser checks use isolated storage and test repositories, never real user notes.

ZenUML and Excalidraw reference upgrades append their versioned sections to an existing owned manual once, preserving previous bytes, annotations and unpinned state. Deleted manuals, user replacements and previously removed reference sections are not restored or overwritten. Browser, device-folder and Git destinations keep their existing save/conflict behavior.
