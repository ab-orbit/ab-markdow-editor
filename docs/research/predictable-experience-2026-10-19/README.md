# Scriba — avaliação de uma experiência previsível

Data: 19 de outubro de 2026. Versão de referência: 1.13.0.

**Atualização às 22h25:** a confirmação de recarregamento foi corrigida e publicada na versão **1.13.1**. Quatro jornadas em produção passaram em Chromium/WebKit, desktop/celular. [Correção e evidências](../../evidence/reload-confirmation/README.md). A avaliação abaixo registra o comportamento observado antes da correção.

## Conclusão

O Scriba oferece proteções úteis para preservar arquivos e uma boa base de leitura e edição visual. A experiência ainda depende de o usuário entender a origem do documento, o destino do salvamento e a diferença entre rascunho, cópia salva e sincronização. Essas distinções precisam ficar visíveis durante o trabalho.

A prioridade de produto é tornar previsível o ciclo **abrir → ler → editar → salvar → reabrir**, mantendo os recursos avançados disponíveis conforme o contexto.

## Comportamento atual

| Jornada | O que já funciona | Lacuna de previsibilidade |
|---|---|---|
| Abrir sem preparação | A versão pública abre Markdown e pacotes sem conta. Arquivos existentes entram em Ler. O aplicativo Mac recebe arquivos do Finder, inclusive fora do repositório. | Um arquivo importado é uma cópia em memória. No Mac, Salvar pode gravá-lo no repositório configurado, preservando o original. Na pasta do dispositivo, novas cópias vão para scriba. O nome na barra não explica essa relação entre origem e destino. |
| Ler sem risco | A abertura não transforma o conteúdo original. Os testes preservaram comentários, referências, blocos, BOM e CRLF. Há proteção contra alterações externas sobre um rascunho. | Ler permite marcar tarefas, editar tabelas e abrir blocos por duplo clique. Uma tarefa pode mudar o Markdown enquanto o modo continua em Ler. Com o automático ativo, um arquivo importado sem edição pode ser adicionado à biblioteca. |
| Editar tabelas | É possível editar células no texto formatado e usar um diálogo com linhas, colunas, alinhamento e ordenação. No mobile, a tabela conserva largura e permite rolagem horizontal sem barra explícita. | Os controles de estrutura e a edição das células estão distribuídos entre experiências diferentes. É preciso tornar o caminho de edição contextual mais uniforme. |
| Editar imagens | Inserção por arquivo, colagem ou arraste; imagens raster acompanham o pacote e o salvamento. | Um Markdown avulso aberto pelo seletor do navegador não concede acesso às imagens vizinhas. A prévia mostra um placeholder, sem uma ação contextual para localizar a imagem. Faltam controles visuais de substituição, descrição e tamanho. |
| Confiar no salvamento | Rascunhos persistem; conflitos são detectados; salvar/fechar tem confirmação. Os testes HTTP/Git verificam gravação, commit, push e preservação após falhas. | O aviso de sucesso desaparece em 4,5 segundos e o rodapé volta a Documento carregado. Faltam destino, horário e estado persistentes por nota. A sincronização remota de todas as notas pendentes ainda depende da evolução da fila. |

O duplo clique para editar blocos atende ao comportamento pedido anteriormente e pode ser desativado nas preferências. Uma promessa de leitura protegida exige explicitar quando esse gesto e os controles de alteração ficam disponíveis.

## Defeito funcional reproduzido: confirmação de recarregamento

Prioridade: alta. O rascunho foi preservado; não houve perda de conteúdo na reprodução.

1. Abrir um Markdown sintético na versão pública e salvar na biblioteca privada do navegador.
2. Editar o fonte sem salvar.
3. Clicar em Recarregar nota.
4. Confirmar Recarregar e descartar rascunho.
5. O diálogo permanece aberto e o conteúdo não é recarregado.

A reprodução foi feita em uma sessão nova de Chromium, diretamente em produção, sem relógio simulado ou seletor de pasta simulado. O mesmo bloqueio também interrompeu o teste existente de recarregamento com uma pasta de dispositivo simulada sobre operações reais de filesystem do navegador.

**Causa identificada:** a função de recarregamento consulta isBlocked antes de fechar a confirmação. A implementação de isBlocked considera qualquer dialog aberto, incluindo o próprio diálogo de confirmação do reload.

**Correção proposta para alinhamento:** permitir que a confirmação inicie o recarregamento, preservando a proteção contra outros diálogos, operações concorrentes e respostas de um documento anterior. Reexecutar o teste de reload com rascunho e as proteções durante respostas atrasadas. Nenhuma correção do produto foi aplicada nesta avaliação.

[Reprodução estruturada](reload-confirmation-reproduction.json) · [Captura da confirmação sem efeito](evidence/06-reload-confirmation-no-effect-desktop.png)

## Prioridade recomendada

1. Corrigir a confirmação de recarregamento após alinhamento.
2. Mostrar continuamente origem, destino, última gravação e estado de sincronização da nota.
3. Definir claramente a proteção do modo Ler e a transição para edição.
4. Diferenciar abrir o original, importar uma cópia e salvar em outro destino, solicitando preparação somente quando necessária.
5. Unificar a edição contextual de tabelas e imagens.

Esses pontos refinam os itens 1–5, 13 e 19 do [backlog de produto](../../BACKLOG.md).

## Validação executada

- **60/60 testes HTTP/Git aprovados** por npm test, incluindo conflitos, imagens, salvamento, troca de repositório, integração remota e retry de push.
- **Leitura e edição aprovadas em Chromium e WebKit**, diretamente na versão pública, com documentos sintéticos. Cobertura: temas claro/escuro; larguras 390, 440, 820, 844, 1180 e 1440; orientações horizontal/vertical; tabelas; edição visual; undo/redo; preservação de trechos não editados, BOM e CRLF; salvamento na biblioteca privada.
- **Atalhos e fechamento aprovados** usando os arquivos publicados, servidos por um proxy de teste local: abrir, salvar, confirmar fechamento, cancelar, descartar e reabrir.
- **Teste de atualização/reload com falha:** chegou à confirmação de recarregamento de uma pasta e não aplicou a versão solicitada. A reprodução direta em produção confirmou o bloqueio descrito acima.
- **Observações da jornada em produção:** entrada em Ler; tarefa editável em Ler; importação salva pelo automático sem alteração do texto; aviso de sucesso ausente após cinco segundos; tabela mobile com conteúdo de 480 px em região de 332 px, mantendo a página em 390 px e scrollbar-width none.

As duas primeiras tentativas dos testes browser-refresh e browser-shortcuts usaram o dist local, que era um build para o aplicativo Mac e dependia da API local. Foram registradas como configuração de teste inadequada. A execução seguinte usou os assets publicados; o teste de atalhos passou e o de reload apresentou a falha funcional reproduzida separadamente. Os logs originais foram mantidos para rastreabilidade.

Os testes usaram dados e contextos isolados. Nenhum repositório pessoal, conta GitHub ou arquivo real do usuário foi utilizado. Viewports e WebKit não substituem validação física do seletor Files, iCloud ou provedores de armazenamento do iOS; esses caminhos nativos não foram executados nesta rodada.

## Evidências

- [Resultados das primeiras execuções](checks.json)
- [Resultados com os assets publicados](production-asset-checks.json)
- [Observações estruturadas da jornada](journey-observations.json)
- [Leitura e edição em Chromium](reading-production-chromium.log)
- [Leitura e edição em WebKit](reading-production-webkit.log)
- [Atalhos com os assets publicados](browser-shortcuts-production.log)
- [Falha no teste de reload](browser-refresh-production.log)

| Captura | Evidência |
|---|---|
| [Arquivo importado em Ler](evidence/01-imported-reading-desktop.png) | O rodapé diz Documento carregado; imagem relativa sem acesso aparece como placeholder. |
| [Tarefa alterada em Ler](evidence/02-task-changed-in-reading.png) | O modo continua em Ler enquanto o Markdown já contém a tarefa marcada. |
| [Após desaparecer a confirmação de salvamento](evidence/03-after-save-notice-disappears.png) | O rodapé não apresenta destino nem horário da gravação. |
| [Tabela e imagem ausente no mobile](evidence/04-table-and-missing-image-mobile.png) | Tabela mantém colunas e rolagem; imagem não resolvida não oferece ação de localização. |
| [Diálogo de tabela no mobile](evidence/05-table-editor-mobile.png) | Edição por células disponível em diálogo que cabe no viewport. |
| [Confirmação de reload sem efeito](evidence/06-reload-confirmation-no-effect-desktop.png) | Confirmação continua aberta depois do clique. |

## Referências técnicas da revisão

- src/main.tsx:337 — abertura externa pelo Finder preserva o original e redireciona o salvamento ao repositório configurado.
- src/main.tsx:461 — a trava de reload considera qualquer dialog aberto.
- src/main.tsx:484 — uma importação passa a ter sincronização/salvamento pendente mesmo sem edição.
- src/main.tsx:497 — os textos de confirmação distinguem navegador, aplicativo, pasta e GitHub.
- src/main.tsx:548 — a confirmação de sucesso é removida após 4.500 ms.
- src/useDocumentReload.ts:43 — a própria confirmação encontra a trava de diálogo antes de iniciar a leitura.
- src/components/Markdown/MarkdownWorkbench.tsx:314 — o modo de leitura recebe callbacks que alteram tarefas e diagramas.
- src/components/Markdown/MarkdownWorkbench.tsx:325 — o rodapé não recebe o destino nem o estado de sincronização do host.
- src/components/Markdown/MarkdownReadingView.tsx:96 — imagem não registrada vira um placeholder sem ação contextual.
- src/components/Markdown/MarkdownReadingView.tsx:102 — checkboxes de leitura permanecem ativos quando existe callback de alteração.
- src/components/Markdown/RichMarkdownEditor.tsx:67 — a imagem visual não possui controles de substituição ou descrição.
- src/lib/markdown/assets.ts:17 — imagens aceitas por assinatura: PNG, JPEG, GIF e WebP; HEIC e SVG não são aceitos.

Critérios de interface consultados: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), especialmente feedback assíncrono, clareza de ações, preservação antes de navegação e alternativas a gestos.
