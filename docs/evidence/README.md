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

## Resolução de versões sem descartar o rascunho

As jornadas importam um Markdown que já existe no repositório e salvam suas alterações com commit/push. Depois, abrem o mesmo arquivo pela lista do repositório e repetem o salvamento. Uma alteração externa de verdade abre a resolução; cancelar preserva o rascunho, e salvar uma cópia mantém a versão externa intacta.

![Resolver versões no desktop](desktop-resolve-file-conflict.png)

![Resolver versões no celular](mobile-resolve-file-conflict.png)

## PWA e recuperação offline

Texto e imagem preservados após recarregamento sem conexão; exportação ZIP validada. Ao reconectar, o mesmo documento chega ao remoto por commit/push. Capturas usam exclusivamente repositórios temporários de teste.

![Rascunho offline desktop](desktop-pwa-offline-draft.png)

![Rascunho offline celular](mobile-pwa-offline-draft.png)

![Configurações PWA desktop](desktop-pwa-install-settings.png)

![Configurações PWA celular](mobile-pwa-install-settings.png)

## Logo no editor e 100 notas recentes

Repositório sintético com 105 notas: a barra lateral limita a lista às 100 mais recentes. A nota salva sobe ao topo; trocar com alterações pendentes solicita confirmação. Cabeçalho com logo e botão para recolher a lista. No celular a lista inicia fechada.

![Desktop com logo e notas, escuro](desktop-recent-notes-dark.png)

![Desktop com logo e notas, claro](desktop-recent-notes-light.png)

![Celular com notas, escuro](mobile-recent-notes-dark.png)

![Celular com notas, claro](mobile-recent-notes-light.png)

## Guia fixado, períodos e leitura suave

A primeira nota fixada explica a plataforma, os recursos e o roadmap de Google Drive/temas. As capturas da lista acima agora mostram períodos e datas curtas. Os testes usam notas com datas de hoje, ontem e dias anteriores, e validam fixar/desafixar sem modificar o Git.

![Guia em leitura, desktop escuro](desktop-guide-reading-dark.png)

![Guia em leitura, celular escuro](mobile-guide-reading-dark.png)
