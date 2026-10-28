# Scriba 1.17.0 (29) — revisão para iPhone Duo

Esta é uma versão candidata local para avaliação do usuário. **Não autoriza envio, substituição de build ou nova submissão no App Store Connect.** A submissão 1.16.1 (27) permanece separada. O build 28 também não deve ser selecionado automaticamente.

## Direção e critérios

Scriba continua sendo uma biblioteca privada de notas, com leitura editorial, edição natural, Markdown, diagramas e whiteboard. A pergunta principal é: **“Como continuo trabalhando nesta mesma nota quando o espaço muda?”** O documento ocupa a área dominante; as ferramentas acompanham o sistema, e a biblioteca acrescenta contexto quando há espaço.

Inventário de produto:

- A pessoa lê, escreve e desenha em uma nota Markdown própria.
- O título identifica o arquivo, e o destino de salvamento continua independente da apresentação.
- A biblioteca mostra notas reais, pesquisa, fixação e miniaturas.
- Leitura, escrita, fonte, prévia e blocos são apresentações da mesma nota.
- O whiteboard permanece um desenho incorporado ao documento, com sua própria recuperação.
- O outline navega pelos títulos sem alterar o texto.
- Abrir um arquivo no Files preserva o diretório configurado.
- Salvar, Salvar como, exportar e recarregar mantêm seus guardas de conflito existentes.

As skills `design-taste-frontend`, `apple-design` e `frontend-design` orientam a revisão. A folha app sorteada foi **true-black-flat**, seed **1312350032**, preservando `palette,type`. Sua contribuição é a hierarquia discreta; a identidade continua no escriba, na tipografia de leitura e nas notas. O material das barras nativas segue o HIG e prevalece sobre a proibição genérica de glass da folha. Tabelas zebradas e parágrafos justificados foram pedidos expressos do usuário e são preservados.

## Adaptações implementadas

| Contexto | Comportamento |
|---|---|
| Barras no Duo/iOS 27.1 | UINavigationController e barras nativas; o sistema decide eixo, borda e overflow. Símbolos têm títulos e prioridades. |
| Área ampla | Biblioteca e nota lado a lado, conforme a largura útil e o tamanho de texto. |
| Área estreita | Uma nota por vez; biblioteca acessível pela navegação. Mesmas funções disponíveis. |
| Dobra vertical ativa | Biblioteca e documento usam regiões separadas; fonte/prévia podem ocupar os dois lados. |
| Dobra horizontal ativa | Leitura acima e biblioteca abaixo; com teclado, prioriza a região de leitura. Fonte/prévia seguem a divisão real. |
| Foco sem biblioteca | O documento usa uma região útil, sem atravessar uma dobra ativa. |
| Câmera/área reservada | Regiões de oclusão publicadas pelo UIKit reservam espaço no conteúdo. |
| Teclado | WKWebView continua ancorado ao keyboardLayoutGuide. Em pouca altura, formatação fica em uma linha rolável. |
| Continuidade | A mesma instância do editor permanece montada; âncoras de leitura acompanham o refluxo. |
| Texto acessível | Dynamic Type amplia texto e títulos; campos de edição preservam o piso de 16 pontos. |
| Whiteboard | Propriedades dimensionadas pelo próprio canvas; troca de modo exige commit/flush do desenho. |
| Configurações e avisos | Configurações, biblioteca sobreposta e avisos permanecem em uma região útil quando há uma divisão ativa. A página de configurações esconde de fato o editor, inclusive na grade ampla. |
| iOS anterior | Mantém a interface web existente e os mesmos recursos de arquivos. |

## Referências Apple e decisões

- [Prepare for iPhone Duo](https://developer.apple.com/iphone-duo/prepare/): usar a geometria atual da janela; evitar orientação, modelo e idiom como decisões de layout.
- [Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo), **Vertical controls**: “Follow the system’s vertical layout”. Por isso as barras são UIKit, com overflow nativo.
- Mesmo HIG, **Dynamic layouts / Reserved regions**: a dobra e a câmera vêm de `ReservedRegion`; a razão entre largura e altura não inventa uma postura.
- Mesmo HIG, **Best practices**: continuidade entre poses e acesso às mesmas funções.
- HIG **Layout / Adaptability** e **Typography / Supporting Dynamic Type**: painéis e títulos acompanham o espaço e o texto escolhido pela pessoa.
- HIG **Split views / Best practices**: seleção da biblioteca permanece visível no painel adjacente.
- HIG **Toolbars / Item groupings**: navegação, ação principal e ferramentas têm grupos reconhecíveis.
- HIG **Accessibility / Mobility** e **Color / Inclusive color**: alvos de toque, rótulos, foco e estados não dependem só de cor.

Os nomes e assinaturas de UIHingeInteraction, ReservedRegion, verticalBarEdge e prioridades foram conferidos no SDK instalado do Xcode 27.1. O skill oficial `app-resizability`, exportado pelo Xcode, confirmou as pré-condições: LaunchScreen existente, quatro orientações do iPad e ausência de UIRequiresFullScreen. Não foi habilitado múltiplo documento em várias cenas: isso exige isolamento adicional de rascunhos por janela.

## Evidências e validação

**A revisão das posturas reais foi concluída após o desbloqueio do Mac.** Os controles oficiais do Device Hub acionaram a tela externa, a tela interna aberta e a dobra parcial, nas duas orientações. A sessão hospedada registrou os valores reais de `workspaceLayout`, sem fabricar a geometria. Geometria de scene redimensionada continua sendo evidência complementar; não é apresentada como dobradiça.

### Resultados confirmados

| Verificação | Resultado | Evidência |
|---|---|---|
| Node/HTTP, incluindo sincronização, conflitos e segurança de arquivos | **95 passaram, 0 falhas** | [Saída completa](node-http-tests.txt) |
| WKWebView real: abertura, persistência, restauração, arquivos, conflito, renomeação, diagramas, canvas e interfaces do sistema | **8 passaram, 0 falhas** no Duo/iOS 27.1 | [Resultado Xcode](native-hosted-result.json) |
| Janela nativa 480×700 → 950×650 → 650×940 → 480×700 | **Passou**: mesma instância WKWebView, mesmo documento e parágrafo de leitura preservado a menos de 32 pontos do topo; fonte/leitura mantêm o conteúdo | [Resultado Xcode](native-resize-result.json) · [Geometria recebida](duo-resize-results.json) |
| Posturas reais e continuidade | **Passou**: dez capturas finais, mesma instância WKWebView, dobra real de 40 pontos, biblioteca adaptada e seção escolhida no índice preservada a menos de 1 ponto do topo após as transições | [Resultado Xcode](native-real-posture-result.json) · [Geometria real](duo-posture-results.json) |
| Interface nativa do Duo | **Passou**: criar, digitar, manter o editor acima do teclado, concluir, salvar, abrir Files e cancelar preservando o texto | [Resultado Xcode](native-ui-result.json) |
| Gesto de toque em uma região útil | **Passou**: a página de configurações continua rolando internamente com a página externa imóvel | [Resultado Xcode](native-touch-scroll-result.json) |
| Regressão da âncora de leitura | **Passou**: quatro refluxos no WebKit, incluindo scroll recebido antes de ResizeObserver e foco no título escolhido pelo índice | `node tests/reading-continuity.smoke.mjs` |
| iPad Air 11 / iOS 18.6 | **Passou**: digitação e área de edição acima do teclado em retrato e paisagem | [Resultado Xcode](ipad-keyboard-result.json) |
| WebKit em 390×844, 844×390, 768×1024, 1024×768 e 1440×900 | **Passou**: ambos os temas, tabela com navegação horizontal, ausência de overflow da página, fonte/leitura/escrita, commit de texto ativo do whiteboard e proteção contra importação obsoleta | [Resultados](browser-regression.json) |
| Fixture de região reservada no CSS | **Passou**: configurações, biblioteca sobreposta e aviso ficam na área designada; editor oculto não reaparece como grade | [Captura da fixture](browser-reserved-region-css-fixture.png), **não é uma postura real do simulador** |
| TypeScript, idiomas e assinatura | TypeScript sem erros; **911 chaves** em en/de/fr com placeholders válidos; assinatura do archive verificada | [Archive candidato](archive-candidate.json) |

A validação é de simulador. A sessão real do Device Hub também confirmou escrita com teclado na dobra parcial em retrato e paisagem, Dynamic Type em escala 1,82, índice contido na região útil, diagramas Pele, fonte/prévia nos dois lados da dobra e configurações em uma só região. O primeiro percurso verificou desenho e persistência do mesmo objeto no whiteboard entre as três posturas. O iPad/iOS 18.6 foi testado novamente após a correção do viewport.

### Capturas da revisão final

![Tela interna aberta: biblioteca de 248 pontos e documento ao lado](duo-posture-final-03-open-library.png)

![Dobra horizontal real: nota acima e biblioteca abaixo](duo-posture-final-07-anchor-partial-portrait.png)

![Fonte e prévia usam regiões separadas da dobra](duo-posture-final-09-source-preview.png)

[Seção na tela externa](duo-posture-final-04-anchor-closed.png) · [Mesma seção na tela aberta](duo-posture-final-05-anchor-open.png) · [Mesma seção com dobra vertical](duo-posture-final-06-anchor-partial.png) · [Texto ampliado](duo-posture-final-08-dynamic-type.png) · [Escrita com teclado](duo-native-writing-keyboard.png) · [Rolagem por toque](duo-inner-settings-touch-scroll.png).

As capturas `duo-posture-*` vêm da janela do aplicativo e não incluem a janela separada do teclado do sistema. Os testes de interface capturam o display ativo, incluindo as interfaces do sistema. Esses frames são brutos: o display interno pode aparecer invertido em relação à apresentação 3D do Device Hub. As capturas da janela UIKit acima têm leitura normal. A revisão inicial do whiteboard está em [dobra parcial](initial-posture-audit/duo-posture-13-partial-whiteboard.png), [aberto](initial-posture-audit/duo-posture-14-open-whiteboard.png) e [externo](initial-posture-audit/duo-posture-16-closed-portrait-whiteboard.png).

[Revisão visual, exceções do inspetor e correções](design-review.md).

### Antes

![Versão 28 na tela externa: controles web no topo e nome truncado](before-outer-build28.png)

### Execução reproduzível

```sh
SCRIBA_IOS_BUILD_NUMBER=29 npm run ios:sync
node scripts/test-duo-resize.mjs <UDID-do-simulador-Scriba-Duo>
node --test tests/workspace-geometry.test.mjs
node tests/reading-continuity.smoke.mjs
npm test
```

O orquestrador usa apenas um simulador Duo isolado, verifica seu nome/tipo, roda o WKWebView real e controla `devicectl device appResize`. Não apaga dados de usuários, não acessa produção e não altera App Store Connect.

Uma tentativa anterior de `appResize` pediu 480×620: o comando informou aceitação, mas a janela observada voltou a 465×667. Esse caso não foi contado como sucesso nem interpretado como postura da dobradiça. O ciclo confirmado retorna a 480×700 e verifica a continuidade de leitura. O primeiro teste de interface também encontrou “Concluir” no overflow com teclado; a ordem da ação foi corrigida e a execução seguinte passou. A coleta longa de diagnóstico desse primeiro teste foi interrompida depois de seu resultado de falha já estar registrado.

### Correções encontradas nas posturas reais

1. **Navegação pelo índice:** o WebKit podia enviar scroll após o refluxo e antes de ResizeObserver, substituindo a âncora antiga por um bloco do novo layout. O hook ignora esse evento enquanto a geometria está pendente. O novo teste falhava antes da correção e passou depois; o percurso real confirmou a mesma seção entre externo, aberto e parcialmente dobrado.
2. **Rotação com teclado:** o WKWebView externo se deslocava 91 pontos para tentar seguir o cursor, embora a nota já possua seu próprio contêiner de rolagem. O wrapper usa a opção pública `ios.scrollEnabled=false` do Capacitor. O offset externo permaneceu zero na repetição; um teste de gesto confirmou que as configurações continuam rolando internamente.

Os dados do diagnóstico anterior estão em [geometria inicial](initial-posture-audit/duo-posture-results.json) e [diagnóstico de viewport](initial-posture-audit/duo-posture-diagnostic.json). Duas primeiras tentativas do novo teste de gesto não chegaram ao gesto: corrigiu-se a preparação da página e a identificação do botão nativo de overflow. A execução final passou. Nenhum desses resultados antigos substitui a evidência final.

### Como repetir as posturas reais

Inicie `ScribaTests/testDuoRealPostureSession` no simulador QA. Use os botões **Closed**, **Partially Open**, **Open** e o menu de orientação do Device Hub. Após estabilizar cada postura, registre:

```sh
node scripts/capture-duo-posture.mjs <UDID-QA> <rotulo> closed
node scripts/capture-duo-posture.mjs <UDID-QA> <rotulo> partiallyOpen
node scripts/capture-duo-posture.mjs <UDID-QA> <rotulo> fullyOpen
node scripts/capture-duo-posture.mjs <UDID-QA> finish
```

O teste confirma as três posturas, ausência de overflow, mesma instância WKWebView e viewport externo imóvel. Um quarto argumento opcional confere o prefixo da seção que deve permanecer no topo. O script só aceita um simulador isolado com nome `Scriba Duo…`; não aciona a dobradiça por APIs privadas.

### Limites e decisão do usuário

Split View entre aplicativos à esquerda/direita e câmera interna ativa não foram exercitados como sessões próprias. O redimensionamento nativo e os testes de regiões reservadas complementam a cobertura, sem serem apresentados como esses cenários. O Scriba não depende de câmera para ler ou editar.

**A candidata 1.17.0 (29) está pronta para a avaliação do usuário no simulador.** A aprovação para upload ou nova submissão continua exclusivamente com o usuário; nenhuma ação foi realizada no App Store Connect durante esta revisão.
