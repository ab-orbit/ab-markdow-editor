# Evidências do editor independente

As jornadas usam repositórios Git e remotos temporários. Nenhum documento do Lab é alterado.

## Desktop — 1440 × 900

Documento salvo no repositório, reaberto com imagem e exibido no modo Ler, após commit e push.

![Desktop, tema escuro](desktop-repository-document-dark.png)

![Desktop, tema claro](desktop-repository-document-light.png)

## Celular — 390 × 844

A mesma jornada em largura de celular, com controles em linhas e sem rolagem horizontal.

![Celular, tema escuro](mobile-repository-document-dark.png)

![Celular, tema claro](mobile-repository-document-light.png)

O seletor de pasta é nativo do macOS e abre uma janela separada. A jornada automatizada simula a resposta do diálogo para testar conexão automática, cancelamento e escolha do destino da clonagem. O helper nativo foi validado adicionalmente pela interface do macOS, selecionando uma pasta real; seu cancelamento também foi validado pela API da aplicação instalada.

## Configurações pela engrenagem

Depois de conectar o repositório, a tela principal mantém apenas o editor. O painel de repositório, arquivos e Git aparece em um diálogo aberto pela engrenagem. Fechar com Escape preserva o texto. As jornadas também verificam que recarregar um repositório configurado mantém o diálogo fechado.

![Configurações no desktop](desktop-settings.png)

![Configurações no celular](mobile-settings.png)

## Salvamento automático e nota do commit

O relógio do navegador avança os intervalos de um e dois minutos; gravação, commits e pushes usam Git e HTTP reais. O remoto só recebe a alteração após confirmar a nota, quando essa opção está ativa. Cancelar preserva o conteúdo ainda não salvo no editor.

![Preferências de salvamento no desktop](desktop-autosave-settings.png)

![Preferências de salvamento no celular](mobile-autosave-settings.png)

![Nota do commit no desktop](desktop-commit-note.png)

![Nota do commit no celular](mobile-commit-note.png)
