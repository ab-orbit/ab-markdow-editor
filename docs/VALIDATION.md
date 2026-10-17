# Validação

Ambiente: macOS Darwin 25.6.0, Apple Silicon. Aplicação instalada em `~/Applications/AB Markdown.app`, com ícone/link na Mesa. Runtime oficial incluído: Node.js v22.23.3 darwin-arm64, arquivo verificado por SHA-256 durante a instalação.

## Verificações

- Build de produção com TypeScript estrito e Vite.
- Instalador executado com PATH restrito a `/usr/bin:/bin:/usr/sbin:/sbin`, sem depender do Node/npm do host.
- Criação e validação do bundle, runtime, ícone `.icns`, helper de seleção nativa e link na Mesa.
- Abertura pelo ícone, resposta saudável do servidor em loopback e carregamento do editor.
- Seleção de pasta real no diálogo nativo do macOS; retorno do caminho confirmado.
- Cancelamento do diálogo pela API da aplicação instalada: HTTP 200, `directory: null`.
- 10 testes HTTP com Git real: sessão/origem/host, conexão e listagem, texto/imagens, conflitos, caminhos inválidos/symlinks, gravações concorrentes, commit seletivo e push, proteção de stage, rejeição de credenciais na URL e clonagem HTTPS com CA local.
- 2 jornadas Playwright: desktop 1440×900 e celular 390×844. Selecionar/cancelar pasta, conectar, escolher destino de clone, editar, inserir imagem, salvar, criar commit, push e reabrir com imagens.
- Temas claro/escuro e contraste ≥4,5:1 dos tokens de texto e acento contra a superfície usada pelo editor, nos dois temas. Sem overflow horizontal no celular.
- Nenhuma alteração em arquivos rastreados de `ab/app/frontend/`; o arquivo GLB não rastreado que já existia no início foi preservado.

O instalador também tem seleção de runtime para Intel x64; a execução física foi validada em Apple Silicon. O build informa um aviso de tamanho do bundle JavaScript; a aplicação é servida localmente. O helper nativo usa assinatura ad hoc, gerada localmente; o bundle não é uma distribuição notarizada pela Apple.

Veja [capturas e legendas](evidence/README.md).
