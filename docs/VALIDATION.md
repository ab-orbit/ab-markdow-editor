# Validação

Ambiente: macOS Darwin 25.6.0, Apple Silicon. Aplicação instalada em `~/Applications/AB Markdown.app`, com ícone/link na Mesa. Runtime oficial incluído: Node.js v22.23.3 darwin-arm64, arquivo verificado por SHA-256 durante a instalação.

## Verificações

- Build de produção com TypeScript estrito e Vite.
- Instalador executado com PATH restrito a `/usr/bin:/bin:/usr/sbin:/sbin`, sem depender do Node/npm do host.
- Criação e validação do bundle, runtime, ícone `.icns`, helper de seleção nativa e link na Mesa.
- Abertura pelo ícone, resposta saudável do servidor em loopback e carregamento do editor.
- Seleção de pasta real no diálogo nativo do macOS; retorno do caminho confirmado.
- Cancelamento do diálogo pela API da aplicação instalada: HTTP 200, `directory: null`.
- 24 testes HTTP com Git real: sessão/origem/host, conexão e listagem, texto/imagens, conflitos, caminhos inválidos/symlinks, gravações concorrentes, commit seletivo e push, proteção de stage, rejeição de credenciais na URL e clonagem HTTPS com CA local; save/commit/push automático, ausência de commits vazios, retry após falha de push sem commit duplicado, recuperação de hook, primeiro upstream e preferências persistidas em novo processo.
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
