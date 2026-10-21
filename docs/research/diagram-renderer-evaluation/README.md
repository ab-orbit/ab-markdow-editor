# Avaliação de diagramas Mermaid para o Scriba

Atualizada em **18/10/2026**. Prioridades: qualidade visual, desempenho durante a edição, mobile, funcionamento offline e preservação do Markdown original.

## Recomendação atual

A integração recomendada para o Scriba é **react-markdown com um componente próprio para o bloco Mermaid completo**, compartilhando o serviço de renderização com os widgets do CodeMirror. **Pele permanece como candidato a motor principal; Mermaid.js é a referência de compatibilidade.** A escolha final de motor depende de testes visuais e de desempenho no aplicativo.

Os dois itens adicionados pelo usuário entram como **alternativas de integração**. Eles utilizam Mermaid.js; não acrescentam, por si, um novo algoritmo de desenho.

## Matriz atualizada

| Item | Camada | Avaliação para o Scriba |
| --- | --- | --- |
| [Mermaid.js](https://mermaid.js.org/config/usage.html) | Motor | Referência para sintaxe, configuração e aparência oficiais. Avaliar tamanho inicial, layout e custo por alteração com carregamento sob demanda. |
| [Pele](https://github.com/obsidianmd/pele) | Motor | Candidato para edição rápida e temas por CSS. Tem layout próprio; a compatibilidade documentada não implica aparência idêntica ou aceitação de todas as configurações. |
| [Beautiful Mermaid](https://github.com/lukilabs/beautiful-mermaid) | Motor | Alternativa com aparência própria e integração React síncrona. Catálogo menor; verificar os tipos usados nas notas. |
| [amrebada/markdown-viewer](https://github.com/amrebada/markdown-viewer) | Aplicação e integração | Referência de implementação com Next.js, Marked, DOMPurify e Mermaid.js. A estratégia atual de processamento global e timers exige adaptação. |
| react-markdown + componente próprio, exemplo fornecido pelo usuário | Integração | **Melhor encaixe na base atual do Scriba**, após os ajustes de estrutura, ciclo assíncrono e cache descritos abaixo. Pode hospedar Mermaid.js ou Pele. |

A comparação dos motores é documental. Os resultados de 44 fixtures do [estudo do Bear](../bear-3.0-14827/README.md) pertencem ao bundle Mermaid 11.16.0 daquele aplicativo; não validam automaticamente Pele, Mermaid 12 ou o aplicativo externo.

## Aplicativo amrebada/markdown-viewer

Revisão estática do commit **cbca71054774fbc5fa3e898938085702e7636344**. O [lockfile](https://github.com/amrebada/markdown-viewer/blob/cbca71054774fbc5fa3e898938085702e7636344/yarn.lock) fixa Mermaid **11.4.1**; a versão declarada do aplicativo é 0.1.0.

O [componente analisado](https://github.com/amrebada/markdown-viewer/blob/cbca71054774fbc5fa3e898938085702e7636344/src/components/markdown-viewer.tsx) apresenta estes pontos:

| Observação estática | Consequência a considerar |
| --- | --- |
| Extração dos blocos por expressão regular antes de processar Markdown | Perde casos válidos e pode interpretar exemplos de documentação como diagramas ativos. |
| Documento convertido e sanitizado novamente em cada renderização | Trabalho global; não há cache explícito por bloco. |
| Timer de 100 ms em cada atualização, sem limpeza | Atraso programado e tarefas pendentes; isso não equivale a debounce com cancelamento. |
| Execução assíncrona sem espera no callback do timer | O tratamento externo não acompanha a conclusão da renderização. |
| Tema fixo e modo permissivo de Mermaid | Tema e política de conteúdo precisam acompanhar o Scriba. |
| Importação estática de Mermaid | Não há carregamento explicitamente condicionado à visibilidade do bloco. |

DOMPurify já faz parte do fluxo HTML. A política para o SVG gerado também precisaria ser definida na adaptação.

O fluxo de gravação em [public/docs](https://github.com/amrebada/markdown-viewer/blob/cbca71054774fbc5fa3e898938085702e7636344/src/actions/file-actions.ts) pertence à aplicação externa. A adaptação manteria o armazenamento atual do Scriba no navegador/Git.

Não foi instalado, compilado ou executado esse aplicativo. As observações não são um benchmark nem uma auditoria completa de segurança. Quantidade de dependências declaradas não foi usada como medida de bundle.

## Exemplo react-markdown + MermaidViewer fornecido pelo usuário

O princípio de reconhecer o bloco pela árvore Markdown e delegar o desenho a um componente é adequado. A atualização depende de `chart`, o que permite preservar desenhos de blocos cujo conteúdo não mudou.

| Ajuste necessário | Implementação recomendada |
| --- | --- |
| O override de `code` mantém o `pre` externo | Interceptar o `pre` e substituir o bloco completo, preservando os offsets da origem. |
| O exemplo usa a propriedade `inline` | Migrar para a API atual: essa propriedade deixou de ser fornecida desde react-markdown 9. |
| IDs sorteados em apenas 10 mil possibilidades | Usar IDs únicos por instância/renderização, com formato aceito pelo motor. |
| Ausência de limpeza e controle de geração | Impedir que trabalho de uma nota ou versão anterior atualize o bloco atual. |
| Biblioteca importada e inicializada no topo do módulo | Centralizar o carregamento/inicialização no serviço cliente. Para SSR, testar explicitamente a fronteira de importação. |
| Tema fixo e modo permissivo | Integrar tema e fonte do Scriba; usar modo estrito e política apropriada para SVG. |
| Sem cache e controle de frequência | Cache limitado por conteúdo, versão do motor e opções relevantes; renderização por bloco após pausa curta na edição. |
| Erro genérico substitui o componente inteiro | Manter origem e diagnóstico no próprio bloco, com recuperação quando o usuário corrigir o texto. |

A remoção de `inline` está no [changelog oficial](https://github.com/remarkjs/react-markdown/blob/main/changelog.md#remove-extra-props-passed-to-certain-components). No exemplo JavaScript, `!inline` pode simplesmente resultar em verdadeiro porque o valor é indefinido; isso não comprova que o componente inteiro deixou de funcionar.

A [documentação React](https://react.dev/reference/react/useEffect) descreve limpeza de efeitos e descarte de resultados obsoletos. A política de Mermaid está documentada em [securityLevel](https://mermaid.js.org/config/usage.html#securitylevel).

O Scriba standalone usa **React + Vite**, com CodeMirror na escrita e react-markdown na leitura. SSR/Next.js seria uma condição de eventual reutilização, enquanto o ciclo de atualização e os offsets importam diretamente para a implementação atual.

## Experimento executado: limites do parser

Executei um experimento com a instalação atual de React/react-markdown do Scriba. Comparei a regex do aplicativo externo com os blocos reconhecidos pelo parser, sem executar Mermaid.

| Entrada própria | Matches da regex | Blocos Mermaid no parser | Resultado |
| --- | ---: | ---: | --- |
| Cerca de crases com LF | 1 | 1 | Caso básico reconhecido por ambos |
| Cerca de crases com CRLF | 0 | 1 | A regex perde um bloco válido |
| Cerca de tils | 0 | 1 | A regex perde um bloco válido |
| Exemplo Mermaid dentro de uma cerca maior de documentação | 1 | 0 | A regex encontra um falso positivo |

O override equivalente ao exemplo do usuário produziu um `pre` contendo o `div` do renderizador. Isso confirma a necessidade de avaliar o wrapper do bloco completo. Não foi tratado como reprodução de falha de hidratação.

- [Script reproduzível](evidence/parser-boundary-experiment.mjs)
- [Resultado observado](evidence/parser-boundary-results.json)
- [Identidade dos arquivos revisados](evidence/source-manifest.json)

Execute a partir de `standalone/markdown-editor`:

```bash
node docs/research/diagram-renderer-evaluation/evidence/parser-boundary-experiment.mjs
```

## Integração proposta para avaliação prática

1. Um serviço recebe o texto do diagrama, versão da origem, dimensões e configuração. O código Markdown continua sendo o conteúdo salvo.
2. Um componente React apresenta o resultado no modo Ler. Um widget CodeMirror usa o mesmo serviço no modo Escrever, preservando o comportamento de editar o bloco.
3. O adaptador seleciona Pele ou Mermaid.js por compatibilidade conhecida e permite escolher o motor original. Um SVG produzido sem erro não prova que todas as diretivas e estilos foram respeitados.
4. Biblioteca, tipos de diagrama, fontes e recursos necessários são publicados localmente e incluídos no cache da PWA. O cache de desenhos tem limite de memória.
5. SVG recebe zoom, arraste e opção de ampliar. Resolver o conflito entre duplo clique para editar no Scriba e duplo clique para zoom de alguns componentes.
6. Erros e resultados assíncronos ficam vinculados à nota e à versão do bloco que os originaram.

O [contrato de compatibilidade do Pele](https://pele.run/compatibility) documenta diferenças de layouts, cores, HTML e plugins. Sua [API](https://pele.run/api) descreve adaptação à largura, carregamento por tipo e gestos de zoom.

## Verificação que falta para escolher o motor

Reexecutar os fixtures do estudo anterior e acrescentar notas representativas, diagramas pequenos/médios/grandes, múltiplos blocos, fontes locais e textos em português. Medir início frio e quente separadamente, tempo até o primeiro desenho, latência por alteração, p50/p95, bytes transferidos e fluidez de interação.

Conferir visualmente rótulos cortados, cruzamentos, cardinalidades ER, subgrafos, estilos, redimensionamento e exportação. Validar Chromium e Safari/WebKit, incluindo aparelhos reais iOS/iPadOS, ambas as orientações e rede bloqueada.

**Ainda não há um benchmark comparativo de motores no Scriba.** As conclusões desta atualização são: preferir a integração por componente próprio, manter o projeto externo como referência e submeter a escolha Pele/Mermaid aos testes acima.
