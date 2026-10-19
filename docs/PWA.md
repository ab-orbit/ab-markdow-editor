# PWA e funcionamento offline

O manifest declara orientação livre e inclui capturas reais do editor em desktop e celular. O registro do service worker começa por um script externo antes da inicialização do React. A [edição nativa iOS](app-store/README.md) usa o mesmo editor empacotado, com recursos locais, e funciona independentemente de instalação PWA e de service worker.

O aplicativo usa manifest com identidade e escopo estáveis, janela standalone, ícones normais e maskable em 192/512 px, favicon, Apple Touch Icon e service worker. O launcher macOS utiliza sempre `http://127.0.0.1:43127`: mudar a porta criaria outra origem e isolaria os rascunhos e a instalação do navegador.

Abra a engrenagem e use **Instalar aplicativo** quando o navegador oferecer a instalação. No Chrome/Edge, a instalação também aparece na barra de endereço/menu. No Safari do Mac, use **Arquivo → Adicionar ao Dock**. O ícone instalado por `install.sh` na Mesa inicia o serviço local; uma PWA instalada pelo navegador não consegue iniciar esse processo sozinha.

Após o primeiro carregamento completo, o shell fica disponível offline. Texto, nome, revisão e imagens locais são persistidos no IndexedDB a cada alteração e restaurados ao reabrir ou recarregar. A exportação `.md`/ZIP funciona offline. A limpeza dos dados do navegador remove esses rascunhos: eles não substituem os documentos e commits no repositório. Janelas privadas não oferecem instalação e podem descartar dados ao fechar.

Leitura e gravação no checkout exigem o serviço local iniciado pelo ícone da Mesa. Push exige acesso ao remoto. Sem essa conexão, o editor mantém o rascunho e informa a sincronização pendente; use Salvar ao reconectar. O salvamento automático pausa offline e retoma os intervalos quando volta a conexão. Não há promessa de tarefas Git em segundo plano depois que a janela fecha.

O cache contém somente recursos estáticos e um HTML sem credencial. `/api/*` e `/health` nunca são interceptados ou armazenados. Ao voltar online, o shell solicita uma credencial nova por uma chamada de mesma origem com cabeçalho próprio. A revisão do disco e a identidade do checkout continuam sendo verificadas antes de gravar. Atualizações não forçam recarga durante a edição: feche todas as janelas do editor e reabra para ativá-las.

Validação: Chrome real em macOS, viewports desktop/celular, service worker, dimensões de ícones, manifest, ausência de erros de instalação além da restrição do contexto privado de teste, reload offline com texto/imagens, exportação ZIP e save/commit/push ao reconectar. Safari/iOS e outros sistemas não foram executados fisicamente nesta rodada.

Referências: [instalação de PWAs](https://web.dev/learn/pwa/installation), [manifest](https://web.dev/learn/pwa/web-app-manifest), [atualizações seguras do service worker](https://developer.chrome.com/docs/workbox/handling-service-worker-updates).

Verificação adicional no aplicativo instalado em `127.0.0.1:43127`, com perfil persistente limpo do Chrome (fora de modo privado): `Page.getInstallabilityErrors` retornou `{"installabilityErrors":[]}`. Bundle/ícone da Mesa atualizados e health check aprovado.
