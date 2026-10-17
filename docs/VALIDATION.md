# Validação

Ambiente: macOS Darwin 25.6.0, Apple Silicon. Aplicação instalada em `~/Applications/AB Markdown.app`, com ícone/link na Mesa. Runtime oficial incluído: Node.js v22.23.3 darwin-arm64, arquivo verificado por SHA-256 durante a instalação.

## Verificações

- Build de produção com TypeScript estrito e Vite.
- Instalador executado com PATH restrito a `/usr/bin:/bin:/usr/sbin:/sbin`, sem depender do Node/npm do host.
- Criação e validação do bundle, runtime, ícone `.icns`, helper de seleção nativa e link na Mesa.
- Abertura pelo ícone, resposta saudável do servidor em loopback e carregamento do editor.
- Seleção de pasta real no diálogo nativo do macOS; retorno do caminho confirmado.
- Cancelamento do diálogo pela API da aplicação instalada: HTTP 200, `directory: null`.
- 27 testes HTTP com Git real: sessão/origem/host, conexão e listagem, texto/imagens, conflitos, caminhos inválidos/symlinks, gravações concorrentes, commit seletivo e push, proteção de stage, rejeição de credenciais na URL e clonagem HTTPS com CA local; save/commit/push automático, ausência de commits vazios, retry após falha de push sem commit duplicado, recuperação de hook, primeiro upstream e preferências persistidas em novo processo.
- 8 jornadas Playwright: desktop 1440×900 e celular 390×844. Selecionar/cancelar pasta, conectar, escolher destino de clone, editar, inserir imagem, salvar, commit/push automáticos e reabrir com imagens; relógio do navegador simula ciclos de 1 e 2 minutos com Git/HTTP reais, nota obrigatória, cancelamento sem gravação, ⌘S e persistência das preferências.
- Regressão do conflito: importação pelo seletor, abertura pela lista, arquivo sem histórico Git, salvamento repetido após perda de resposta, hash original válido/inválido, cópia de recuperação, substituição com backup e rejeição de confirmação desatualizada.
- Interface focada no editor após configuração, inclusive ao recarregar; engrenagem abre configurações; Escape fecha sem perder o texto; gravação disponível na barra e por ⌘S.
- Temas claro/escuro e contraste ≥4,5:1 dos tokens de texto e acento contra a superfície usada pelo editor, nos dois temas. Sem overflow horizontal no celular.
- Nenhuma alteração em arquivos rastreados de `ab/app/frontend/`; o arquivo GLB não rastreado que já existia no início foi preservado.

O instalador também tem seleção de runtime para Intel x64; a execução física foi validada em Apple Silicon. O build informa um aviso de tamanho do bundle JavaScript; a aplicação é servida localmente. O helper nativo usa assinatura ad hoc, gerada localmente; o bundle não é uma distribuição notarizada pela Apple.

Veja [capturas e legendas](evidence/README.md).

## PWA Escriba

Manifest/ícones normais e maskable, favicon/Apple Touch Icon, service worker e cache estático sem credenciais validados. As novas jornadas verificam reload offline, IndexedDB com texto e imagens, exportação ZIP offline e sincronização real após reconectar. Testes HTTP cobrem sessão recuperada com cabeçalho de mesma origem, tipos MIME e bloqueio de gravação de rascunho em outro checkout. Chrome usa contextos privados isolados: o diagnóstico de instalação só apresentou a restrição `in-incognito`, sem erros do aplicativo. Safari/iOS não foram executados nesta rodada.

Verificação adicional no aplicativo instalado em `127.0.0.1:43127`, com perfil persistente limpo do Chrome (fora de modo privado): `Page.getInstallabilityErrors` retornou `{"installabilityErrors":[]}`. Bundle/ícone da Mesa atualizados e health check aprovado.

### Ícone do Finder após atualização

Trocar apenas `AppIcon.icns` não atualizou o ícone apresentado pelo atalho existente. O instalador agora aplica a arte pelo `NSWorkspace.setIcon` ao bundle e ao atalho recém-criado, notificando a mudança ao Finder. Correção executada no Mac e conferida visualmente em **Obter Informações** do atalho da Mesa: miniatura e prévia mostram o escriba azul/laranja. Nenhum reinício do Finder ou limpeza global de cache foi necessário.

A verificação posterior em lista revelou que o link simbólico ainda podia aparecer como pasta em outra janela do Finder. O instalador passou a criar um **alias nativo (bookmark do macOS)**, com ícone próprio. Validado na linha AB Markdown da lista da Mesa: escriba visível. Testadas criação/recriação do alias, resolução para o aplicativo correto e rejeição de um arquivo alheio sem alteração do conteúdo.


## Identidade no editor e notas recentes

Logo de 64 px visível no cabeçalho do editor; favicon, Apple Touch Icon e manifest usam caminhos novos em `icons/profile-v3/`, evitando as URLs que ficaram no cache anterior. A barra lateral mostra até 100 Markdown por mtime decrescente, incluindo arquivos não rastreados e excluindo links simbólicos/arquivos removidos. Abrir nota exige confirmação quando há edição pendente. Novo salvamento atualiza a ordem; botão de atualização permite reler alterações externas.

Jornadas desktop/mobile criam 105 notas, verificam exatamente 100 entradas ordenadas, abrem notas, cancelam/confimam descarte, salvam com Git real e conferem reordenação, imagem carregada, URL nova do favicon e ausência de overflow horizontal. Capturas nos dois temas. No celular, a lista inicia recolhida, abre pelo botão Notas e recolhe após abrir uma nota.

## Layout compacto inspirado na referência de notas

Cabeçalho reduzido de 96 para 48 px; lateral de 264 para 220 px; barras de ajuda removidas visualmente e formatação recolhida por padrão. Importação/exportação mantêm nomes acessíveis e dicas, usando botões de ícone. Lista e documento têm rolagem independente e o shell cabe em 100dvh, sem rolagem da página. A lista usa título do Markdown e trecho textual obtidos de até 8 KB por arquivo, com leitura em lotes de 32; conteúdo aparece como texto, sem execução de HTML.

As 8 jornadas de navegador passaram nos dois tamanhos, incluindo abrir/recolher formatação, lista com título/trecho, limite de altura da janela e os fluxos anteriores de edição/Git/offline. Os 27 testes HTTP também passaram. Capturas atualizadas nos temas claro e escuro.

## Remoção da faixa superior e busca

Faixa de marca acima do workspace removida; logo mantida apenas no cabeçalho da lista. Controle da lateral transferido para a barra do editor. Busca local por título, trecho e nome/caminho das 100 notas recentes, com normalização de caixa e acentos, contagem de resultados e estado vazio. Jornadas desktop/mobile verificam título em maiúsculas, busca sem acento, nome do arquivo, resultado inexistente e restauração das 100 entradas ao limpar.

## Fixadas, guia inicial, períodos e tipografia

27 testes HTTP aprovados, incluindo criação única do guia com commit/push a remoto Git real, ausência de novo commit ao reinicializar, pins persistidos e isolados por checkout, desafixar sem alterar HEAD e rejeição de caminho inválido. As 8 jornadas completas passaram; as 2 jornadas da lateral foram ampliadas e repetidas para validar períodos (hoje/ontem/últimos 7 dias), “há 2 h”, guia como primeira fixada, fixar/desafixar, busca e leitura sem fonte monoespaçada.

Paleta local suave nos dois temas, alterada nos tokens. Contraste na superfície selecionada, o caso mais desfavorável: tema escuro texto 9,64:1 / secundário 5,75:1 / acento 6,38:1; tema claro texto 9,71:1 / secundário 4,77:1 / acento 5,52:1. Código e Fonte preservam monoespaçada. Capturas de leitura do guia e lista com grupos em desktop e celular.

## Imagem de boas-vindas e miniatura da nota

27 testes HTTP e 8 jornadas de navegador aprovados. Validação da miniatura carregada na lista e imagem aberta em leitura, JPG junto ao Markdown no remoto Git, migração única de guia existente preservando texto editado, rejeição de traversal/SVG/symlinks e ausência de busca remota. A miniatura usa IntersectionObserver e uma chamada autenticada separada; não carrega imagens de todas as notas de uma vez. Capturas de guia e lista atualizadas em desktop/mobile.

## Matriz responsiva — celular e tablet nas duas orientações

13 jornadas Chrome (as 8 anteriores + 4 perfis responsivos + compatibilidade de rascunhos anteriores) e 4 jornadas WebKit; cada perfil responsivo gira entre vertical e horizontal, exercita toque, Visão, edição, imagens, tabela, preferências, nota de commit, save/commit/push, ZIP, área reduzida de 280 px e edição offline seguida de sincronização. 27 testes HTTP. Ver [matriz, defeito reproduzido e limites](RESPONSIVE.md) e [capturas por motor/perfil/orientação](evidence/RESPONSIVE.md).

A revisão visual identificou ainda uma falha de armazenamento de File/Blob no IndexedDB do WebKit. Corrigida com bytes ArrayBuffer, metadados e fila de gravação. Novas asserções exigem ausência de alertas, dados e bytes persistidos e recuperação após reload em cada orientação. Rascunhos anteriores com File foram testados em uma jornada própria e continuam legíveis/exportáveis.
