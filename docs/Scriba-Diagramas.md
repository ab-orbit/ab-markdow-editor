# Scriba — Manual contextual de diagramas

<!-- scriba-reference:diagram-manual version=1 -->

**Edição 1.0.0 · 19 de outubro de 2026.** Uma biblioteca de exemplos para escolher uma representação, adaptar seu código e comparar o resultado no Scriba. O arquivo é versionado com o produto e aparece como nota fixada junto ao guia.

## Como usar este manual

1. Comece pela pergunta que precisa responder. Cada exemplo apresenta uma pergunta, uma forma de ler o desenho e uma orientação de adaptação.
2. O bloco `mermaid` aparece como desenho em **Ler**, **Visão** e na prévia de **Escrever**. Use o **lápis sobre o desenho** para revelar o Markdown. **Fonte** mostra o arquivo completo; copie apenas o exemplo que precisa para sua própria nota.
3. Compare **Mermaid 12.2.0**, **Pele 1.6.0** e **Beautiful Mermaid 1.1.3** pelo seletor de cada desenho. A escolha não altera o código. A cobertura dos exemplos está na matriz abaixo.
4. Ative a **lupa 2×** para inspecionar detalhes; passe o mouse ou arraste o dedo. **Esc** desativa. No teclado, use Tab até o desenho e as setas para explorar.
5. Preserve a pergunta e uma explicação textual ao reutilizar o código. Pessoas que não veem o gráfico também precisam entender a decisão ou o dado.

Todos os nomes de acervos, números, datas e cenários deste manual são **ilustrativos**. “Acervo Aurora” é um sistema fictício usado para conversar sobre pesquisa, curadoria e trabalho com evidências. As arquiteturas, automações e modelos de dados são propostas de domínio; não descrevem funcionalidades já implementadas no Scriba nem anunciam um compromisso de roadmap.

## Escolha rápida

| Pergunta | Comece por |
| --- | --- |
| O que acontece em seguida e onde há decisão? | Fluxograma |
| Quem faz cada etapa? | Raias ou casos de uso |
| Quem envia o quê, em qual ordem? | Sequência |
| Em que condição um objeto pode estar? | Estados |
| Quais entidades existem e como se relacionam? | ER ou classes |
| Qual requisito será comprovado por qual teste? | Requisitos |
| Qual é a fronteira de um sistema e seus níveis internos? | C4 ou arquitetura |
| Quando algo acontece e do que depende? | Gantt ou linha do tempo |
| Qual é a composição, comparação ou distribuição? | Pizza, XY, Sankey, treemap ou radar |
| Quais critérios se sobrepõem? | Venn |
| Que hipóteses ou abordagens precisam ser discutidas? | Ishikawa, Wardley ou Cynefin |
| Quais entradas uma linguagem permite? | Railroad, EBNF, ABNF ou PEG |

## Compatibilidade observada

<!-- compatibility:start -->
Verificado no próprio Scriba em **19/10/2026**: **58 exemplos**, agrupados em **33 famílias**, incluindo o diagnóstico `info`. Mermaid 12.2.0: **58/58**; Pele 1.6.0: **58/58**; Beautiful Mermaid 1.1.3: **21/58**.

| Família / variação | Exemplos | Mermaid | Pele | Beautiful Mermaid |
| --- | ---: | --- | --- | --- |
| Fluxogramas e formas | 7 | Sim (7/7) | Sim (7/7) | Sim (7/7) |
| Raias | 1 | Sim (1/1) | Sim (1/1) | Não |
| Casos de uso | 1 | Sim (1/1) | Sim (1/1) | Não |
| Jornada | 1 | Sim (1/1) | Sim (1/1) | Não |
| Sequência | 4 | Sim (4/4) | Sim (4/4) | Sim (4/4) |
| Estados | 3 | Sim (3/3) | Sim (3/3) | Sim (3/3) |
| Entidade e relacionamento | 2 | Sim (2/2) | Sim (2/2) | Sim (2/2) |
| Classes | 2 | Sim (2/2) | Sim (2/2) | Sim (2/2) |
| Requisitos | 1 | Sim (1/1) | Sim (1/1) | Não |
| Mapa mental | 1 | Sim (1/1) | Sim (1/1) | Não |
| Árvore | 1 | Sim (1/1) | Sim (1/1) | Não |
| Railroad, EBNF, ABNF e PEG | 4 | Sim (4/4) | Sim (4/4) | Não |
| Blocos | 1 | Sim (1/1) | Sim (1/1) | Não |
| Arquitetura | 1 | Sim (1/1) | Sim (1/1) | Não |
| C4: contexto a implantação | 5 | Sim (5/5) | Sim (5/5) | Não |
| Pacotes | 1 | Sim (1/1) | Sim (1/1) | Não |
| Fluxo de agentes | 1 | Sim (1/1) | Sim (1/1) | Não |
| Gantt | 2 | Sim (2/2) | Sim (2/2) | Não |
| Linha do tempo | 1 | Sim (1/1) | Sim (1/1) | Não |
| Kanban | 1 | Sim (1/1) | Sim (1/1) | Não |
| Histórico Git | 2 | Sim (2/2) | Sim (2/2) | Não |
| Pizza | 1 | Sim (1/1) | Sim (1/1) | Não |
| Quadrantes | 1 | Sim (1/1) | Sim (1/1) | Não |
| XY: barras, linha e combinado | 3 | Sim (3/3) | Sim (3/3) | Sim (3/3) |
| Radar | 1 | Sim (1/1) | Sim (1/1) | Não |
| Sankey | 1 | Sim (1/1) | Sim (1/1) | Não |
| Treemap | 1 | Sim (1/1) | Sim (1/1) | Não |
| Venn | 1 | Sim (1/1) | Sim (1/1) | Não |
| Modelagem de eventos | 2 | Sim (2/2) | Sim (2/2) | Não |
| Ishikawa | 1 | Sim (1/1) | Sim (1/1) | Não |
| Wardley | 1 | Sim (1/1) | Sim (1/1) | Não |
| Cynefin | 1 | Sim (1/1) | Sim (1/1) | Não |
| Diagnóstico (info) | 1 | Sim (1/1) | Sim (1/1) | Não |

“Sim” significa que os exemplos renderizaram como SVG no aplicativo. Não garante equivalência de formas, posicionamento ou tipografia entre motores, nem todas as combinações de uma gramática. Os testes mantêm o código original e verificam que a troca de motor não grava alterações na nota.
<!-- compatibility:end -->

Os sufixos `-beta` fazem parte da sintaxe de algumas famílias experimentais. Eles não são uma instrução de execução. O conjunto inclui as famílias nativas do Mermaid instalado, suas principais variações de estrutura e o diagnóstico `info`; não enumera todas as combinações possíveis de opções.

## Índice por contexto

- [Processos e responsabilidades](#processos-e-responsabilidades)
- [Interações e ciclos de vida](#interações-e-ciclos-de-vida)
- [Estruturas e contratos](#estruturas-e-contratos)
- [Arquitetura e integração](#arquitetura-e-integração)
- [Planejamento e evolução](#planejamento-e-evolução)
- [Métricas e conjuntos](#métricas-e-conjuntos)
- [Decisões e aprendizado](#decisões-e-aprendizado)
- [Diagnóstico](#diagnóstico)

## Convenções para construir e revisar

- **Identificador e rótulo são coisas diferentes.** `Review[Revisar evidência]` usa `Review` como identificador e apresenta a expressão entre colchetes para quem lê.
- **O primeiro comando escolhe a família.** `erDiagram` descreve entidades; `edDiagram` não é uma variante válida. `graph` é um alias de fluxograma.
- **Direção é uma escolha narrativa.** TD/TB desce, LR segue à direita, RL segue à esquerda e BT sobe. Prefira o percurso que acompanha a pergunta.
- **Uma seta precisa de significado.** Ela pode indicar sequência, chamada, dependência ou quantidade. Diga qual desses sentidos está usando.
- **Números precisam de unidade e base.** Registre período, denominador e regra de agregação. As amostras deste arquivo não são resultados de avaliação do produto.
- **Um desenho pequeno é mais fácil de revisar.** Divida processos grandes por pergunta ou fronteira. Mantenha o contexto no texto que acompanha cada recorte.
- **Compare no leitor de destino.** Layout, quebra de texto, formas modernas e famílias experimentais podem diferir entre motores.
- **Conteúdo continua sendo Markdown.** O desenho não executa código, não cria serviços, não faz operações Git e não instala extensões.
- **O Scriba limita cada bloco a 50 mil caracteres.** Links e imagens externas do SVG são removidos. Os exemplos deste arquivo usam texto e recursos locais, com as cores do aplicativo.

## Processos e responsabilidades

### Revisão de evidências com decisão

**Pergunta:** Como uma observação vira uma evidência revisada?

<!-- diagram-example: flow-review family=flowchart -->
<!-- example-compatibility: flow-review -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
flowchart TD
  Capture[Registrar observação] --> Source{Fonte verificável?}
  Source -->|Sim| Review[Revisar interpretação]
  Source -->|Ainda não| Research[Buscar fonte primária]
  Research --> Source
  Review --> Publish[Incluir no dossiê]
```

**Leia assim:** O losango separa o caminho sustentado por fonte da coleta complementar. A volta para a pesquisa representa retrabalho explícito.

**Adapte:** Troque os critérios do losango e dê nome às saídas. Um rótulo como “Fonte verificável?” é mais acionável que “OK?”.

### Relações, dependências e caminhos alternativos

**Pergunta:** Quais ligações representam execução, dependência ou consulta?

<!-- diagram-example: flow-edges family=flowchart -->
<!-- example-compatibility: flow-edges -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
flowchart LR
  Source[(Catálogo de fontes)] -. consulta .-> Analyst[Analisar contexto]
  Analyst ==>|fluxo principal| Brief[Produzir síntese]
  Brief -->|revisão| Reviewer[Revisar afirmações]
  Reviewer -->|ajustes| Analyst
  Reviewer -->|aprovação| Archive[(Arquivo de pesquisa)]
```

**Leia assim:** A linha tracejada representa consulta; a seta grossa destaca o percurso principal. O texto da ligação preserva o significado mesmo sem cores.

**Adapte:** Mantenha uma legenda textual e use o mesmo tipo de ligação para o mesmo significado em todo o documento.

### Formas como vocabulário visual

**Pergunta:** Como distinguir entrada, tarefa, decisão, armazenamento e encerramento?

<!-- diagram-example: flow-shapes family=flowchart -->
<!-- example-compatibility: flow-shapes -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
flowchart TB
  Start([Início]) --> Input[/Pergunta de pesquisa/]
  Input --> Task[Coletar referências]
  Task --> Check{Cobertura suficiente?}
  Check -->|Sim| Reusable[[Aplicar roteiro de revisão]]
  Check -->|Não| Task
  Reusable --> Store[(Dossiê versionado)]
  Store --> Finish([Encerramento])
```

**Leia assim:** Cada forma recebe uma função: entrada em paralelogramo, tarefa em retângulo, decisão em losango e arquivo em cilindro.

**Adapte:** Escolha poucas formas e explique seu papel. A mesma forma deve manter a mesma função nos outros diagramas.

### Direção BT para explicar dependências de baixo para cima

**Pergunta:** De quais insumos depende uma recomendação?

<!-- diagram-example: flow-bt family=flowchart -->
<!-- example-compatibility: flow-bt -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
flowchart BT
  PublicData[Dados públicos] --> Evidence[Evidências verificadas]
  Interviews[Entrevistas consentidas] --> Evidence
  Evidence --> Hypothesis[Hipóteses comparadas]
  Hypothesis --> Recommendation[Recomendação contextualizada]
```

**Leia assim:** BT posiciona as fontes na base e a recomendação no topo. A seta mantém o sentido de dependência descrito no texto.

**Adapte:** Use esta orientação para sustentação e linhagem. Para sequência cronológica, prefira um fluxo temporal consistente.

### Direção RL para rastrear uma conclusão até a origem

**Pergunta:** Como auditar uma conclusão a partir de suas referências?

<!-- diagram-example: flow-rl family=flowchart -->
<!-- example-compatibility: flow-rl -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
flowchart RL
  Decision[Decisão registrada] --> Claim[Afirmação citada]
  Claim --> Evidence[Recorte verificável]
  Evidence --> Document[Documento original]
  Document --> Origin[Instituição publicadora]
```

**Leia assim:** A leitura começa à direita na decisão e segue para evidência e documento original. O desenho explicita o trajeto de auditoria.

**Adapte:** Mude a direção para LR quando a explicação partir da coleta. A orientação deve seguir a pergunta de quem lê.

### Subgrupos para separar responsabilidades

**Pergunta:** Onde termina a coleta e começa a curadoria?

<!-- diagram-example: flow-boundaries family=flowchart -->
<!-- example-compatibility: flow-boundaries -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
flowchart LR
  subgraph Collection[Coleta]
    Search[Pesquisar] --> Register[Registrar fonte]
  end
  subgraph Curation[Curadoria]
    Validate[Validar referência] --> Classify[Classificar evidência]
  end
  subgraph Delivery[Entrega]
    Synthesize[Escrever síntese] --> Review[Revisar dossiê]
  end
  Register --> Validate
  Classify --> Synthesize
  Review -->|pendência| Search
```

**Leia assim:** Os subgrupos representam responsabilidades. O caminho “pendência” volta à coleta, sem esconder a necessidade de revisão.

**Adapte:** Substitua os grupos por equipes, sistemas ou etapas. As fronteiras organizam o desenho, mas não comprovam uma política de acesso.

### Sintaxe moderna de formas

**Pergunta:** Como representar documento, banco e operação manual com formas nomeadas?

<!-- diagram-example: flow-modern-shapes family=flowchart -->
<!-- example-compatibility: flow-modern-shapes -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
flowchart LR
  Question@{ shape: doc, label: "Pergunta registrada" }
  Collection@{ shape: cyl, label: "Acervo de evidências" }
  Review@{ shape: manual, label: "Revisão humana" }
  Decision@{ shape: diam, label: "Pronto para síntese?" }
  Question --> Collection --> Review --> Decision
```

**Leia assim:** A notação @{ shape: ... } escolhe formas por identificador. Este é um exemplo de sintaxe cuja cobertura deve ser comparada entre motores.

**Adapte:** Comece por formas simples em materiais que circularão em leitores diferentes. Compare a matriz de compatibilidade antes de depender de uma forma específica.

### Raias para mostrar passagem entre papéis

**Pergunta:** Quem faz cada etapa e em qual momento o trabalho muda de responsável?

<!-- diagram-example: swim-review family=swimlane -->
<!-- example-compatibility: swim-review -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
swimlane-beta LR
  subgraph Research[Pesquisa]
    Find[Encontrar fonte] --> Submit[Enviar evidência]
  end
  subgraph Review[Revisão]
    Verify[Verificar citação] --> Accept[Aceitar referência]
  end
  subgraph Editorial[Editorial]
    Draft[Escrever síntese] --> Deliver[Entregar dossiê]
  end
  Submit --> Verify
  Accept --> Draft
```

**Leia assim:** As raias agrupam ações por papel. A passagem de coleta para revisão mostra um ponto de entrega, que pode exigir informação mínima.

**Adapte:** Dê às raias nomes de papéis estáveis. Use swimlane-beta como sintaxe experimental e confira o resultado no motor escolhido.

### Casos de uso e fronteira de produto

**Pergunta:** Quais objetivos uma pessoa busca ao usar um acervo de pesquisa?

<!-- diagram-example: usecase-roles family=usecase -->
<!-- example-compatibility: usecase-roles -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
usecase-beta
direction LR
actor Researcher("Pesquisadora")
actor Reviewer("Revisora")
systemBoundary Workspace["Acervo Aurora"]
  Capture("Registrar evidência")
  Organize("Organizar dossiê")
  Verify("Verificar referência")
  Review("Revisar síntese")
end
Researcher --> Capture
Researcher --> Organize
Reviewer --> Review
Capture ..> : include Verify
```

**Leia assim:** Os atores se ligam a objetivos; a fronteira reúne capacidades de um produto hipotético. A inclusão registra uma etapa compartilhada.

**Adapte:** Use verbos orientados a objetivos. Este modelo é uma proposta de domínio, não uma lista de funcionalidades já entregues pelo Scriba.

### Jornada para localizar fricção no trabalho

**Pergunta:** Em quais etapas a experiência de produzir um dossiê piora?

<!-- diagram-example: journey-evidence family=journey -->
<!-- example-compatibility: journey-evidence -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
journey
  title Preparar um dossiê de pesquisa
  section Descoberta
    Definir pergunta: 4: Pesquisa
    Encontrar fonte primária: 2: Pesquisa
  section Organização
    Relacionar referências: 3: Pesquisa
    Revisar interpretação: 4: Pesquisa, Revisão
  section Entrega
    Consultar síntese: 5: Leitura
```

**Leia assim:** As notas de 1 a 5 são avaliações fictícias de experiência. Uma etapa com nota baixa indica uma hipótese de fricção a investigar.

**Adapte:** Troque as notas por observações de entrevistas ou testes e registre amostra, data e critério. A nota não mede produtividade automaticamente.

## Interações e ciclos de vida

### Sequência de salvamento e confirmação

**Pergunta:** Qual participante confirma cada etapa de um salvamento?

<!-- diagram-example: sequence-save family=sequence -->
<!-- example-compatibility: sequence-save -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
sequenceDiagram
  autonumber
  actor Writer as Autora
  participant Editor as Editor
  participant Disk as Armazenamento local
  participant Remote as Repositório remoto
  Writer->>Editor: Salvar nota
  activate Editor
  Editor->>Disk: Gravar Markdown
  Disk-->>Editor: Gravação concluída
  Editor->>Remote: Enviar revisão
  Remote-->>Editor: Revisão recebida
  Editor-->>Writer: Confirmar sincronização
  deactivate Editor
```

**Leia assim:** A linha do tempo desce na página. As mensagens de retorno distinguem gravação local de confirmação remota.

**Adapte:** Nomeie cada confirmação pelo que ela garante. Um retorno de gravação local não garante que o envio remoto terminou.

### Alternativas, repetição e retentativa limitada

**Pergunta:** O que acontece se o serviço de fontes estiver indisponível?

<!-- diagram-example: sequence-retry family=sequence -->
<!-- example-compatibility: sequence-retry -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
sequenceDiagram
  participant Client as Curadoria
  participant Source as Catálogo de fontes
  loop Até três tentativas
    Client->>Source: Consultar identificador
    alt Fonte disponível
      Source-->>Client: Referência e data
    else Serviço indisponível
      Source-->>Client: Falha temporária
      Note over Client: Aguardar antes de repetir
    end
  end
```

**Leia assim:** O bloco alt separa sucesso e indisponibilidade. O loop estabelece um limite explícito para novas tentativas.

**Adapte:** Registre a política real de retentativa e a decisão após o limite. O desenho não implementa timeout nem tratamento de erro.

### Consulta paralela e etapa opcional

**Pergunta:** Quais consultas podem ocorrer independentemente antes da síntese?

<!-- diagram-example: sequence-parallel family=sequence -->
<!-- example-compatibility: sequence-parallel -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
sequenceDiagram
  participant Analyst as Analista
  participant Registry as Registro público
  participant Archive as Arquivo documental
  par Consultar cadastro
    Analyst->>Registry: Buscar instituição
    Registry-->>Analyst: Identificador
  and Consultar documento
    Analyst->>Archive: Buscar publicação
    Archive-->>Analyst: Documento
  end
  opt Divergência entre referências
    Analyst->>Archive: Solicitar versão anterior
    Archive-->>Analyst: Histórico disponível
  end
  Note over Analyst: Comparar as duas evidências
```

**Leia assim:** par apresenta dois caminhos paralelos. opt representa uma checagem adicional feita somente quando há uma dúvida.

**Adapte:** Só declare paralelismo quando as operações forem independentes. Use as mensagens finais para indicar a necessidade de reunir os resultados.

### Mensagem assíncrona e participação temporária

**Pergunta:** Como documentar o envio de uma tarefa sem esperar pela execução completa?

<!-- diagram-example: sequence-async family=sequence -->
<!-- example-compatibility: sequence-async -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
sequenceDiagram
  participant Queue as Fila de revisão
  participant Coordinator as Coordenação
  Coordinator-)Queue: Solicitar revisão
  create participant Worker as Revisão temporária
  Queue->>Worker: Entregar tarefa
  Worker-->>Coordinator: Revisão concluída
  destroy Worker
  Coordinator->>Worker: Encerrar participação
```

**Leia assim:** A seta aberta representa uma notificação assíncrona. O participante temporário é criado para a tarefa e encerrado depois do resultado.

**Adapte:** Separe aceitação da tarefa e conclusão do trabalho. Confirme a sintaxe de criação/destruição quando exportar para outro leitor.

### Ciclo de vida de uma nota

**Pergunta:** Quais estados de uma nota precisam ser distinguidos?

<!-- diagram-example: state-note family=state -->
<!-- example-compatibility: state-note -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
stateDiagram-v2
  [*] --> Draft
  state "Rascunho" as Draft
  state "Salva localmente" as Local
  state "Sincronizada" as Synced
  state "Envio pendente" as Pending
  Draft --> Local: salvar
  Local --> Synced: envio confirmado
  Local --> Pending: envio falhou
  Pending --> Synced: tentar novamente
  Synced --> Draft: editar
```

**Leia assim:** Os estados diferenciam rascunho, gravação e sincronização. Um erro de envio conserva o estado local e permite nova tentativa.

**Adapte:** Use estados observáveis, com eventos nas transições. Um estado deve expressar uma condição, não apenas o nome de um botão.

### Estado composto para revisão interna

**Pergunta:** Como detalhar uma revisão sem espalhar todos os seus passos pelo ciclo externo?

<!-- diagram-example: state-composite family=state -->
<!-- example-compatibility: state-composite -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
stateDiagram-v2
  [*] --> Intake
  Intake --> Review: evidência recebida
  state Review {
    [*] --> SourceCheck
    SourceCheck --> Interpretation: fonte confirmada
    Interpretation --> [*]: parecer registrado
  }
  Review --> Approved: revisão concluída
  Approved --> [*]
```

**Leia assim:** Review contém suas próprias etapas. A transição para Approved acontece depois da conclusão interna.

**Adapte:** Expanda apenas os estados que precisam de detalhe. Mantenha nomes exclusivos para os identificadores, mesmo quando os rótulos forem semelhantes.

### Escolha e divisão em verificações paralelas

**Pergunta:** Uma evidência precisa de decisão condicional ou de verificações simultâneas?

<!-- diagram-example: state-choice family=state -->
<!-- example-compatibility: state-choice -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
stateDiagram-v2
  state HasSource <<choice>>
  state Checks <<fork>>
  state Ready <<join>>
  [*] --> HasSource
  HasSource --> Rejected: sem referência
  HasSource --> Checks: referência disponível
  Checks --> Identity
  Checks --> DateCheck
  Identity --> Ready
  DateCheck --> Ready
  Ready --> Accepted
  Accepted --> [*]
  Rejected --> [*]
```

**Leia assim:** choice decide o caminho; fork separa verificações; join exige que elas se encontrem antes da aceitação.

**Adapte:** Declare as condições na escolha e o critério de conclusão no encontro. Paralelismo em estados não define concorrência de software.

## Estruturas e contratos

### Entidades de um acervo de notas

**Pergunta:** Quais entidades precisam de identidade e quais relações conectam as notas?

<!-- diagram-example: er-notes family=er -->
<!-- example-compatibility: er-notes -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
erDiagram
  NOTEBOOK ||--o{ NOTE : contains
  NOTE ||--o{ REVISION : records
  NOTE ||--o{ ATTACHMENT : includes
  NOTE ||--o{ NOTE_TAG : classifies
  TAG ||--o{ NOTE_TAG : identifies
  NOTE {
    string id PK
    string notebook_id FK
    string title
    datetime updated_at
  }
  REVISION {
    string id PK
    string note_id FK
    string content_hash UK
  }
  ATTACHMENT {
    string id PK
    string note_id FK
    string relative_path
  }
```

**Leia assim:** Uma pasta contém notas; uma nota possui revisões e anexos. NOTE_TAG resolve a associação entre notas e tags.

**Adapte:** Separe o modelo conceitual da implementação física. Os atributos e relacionamentos não criam tabelas nem migrações.

### Cardinalidades, opcionalidade e tipos de vínculo

**Pergunta:** O que pode faltar, o que é obrigatório e quando o vínculo participa da identidade?

<!-- diagram-example: er-cardinality family=er -->
<!-- example-compatibility: er-cardinality -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
erDiagram
  DOSSIER ||--|{ SECTION : requires
  SECTION ||--o{ EVIDENCE : contains
  SOURCE |o..o{ EVIDENCE : may_support
  REVIEWER }o..o{ EVIDENCE : reviews
```

**Leia assim:** Os símbolos nas extremidades indicam mínimo e máximo. A linha contínua e a tracejada distinguem vínculos identificadores e não identificadores.

**Adapte:** Valide a regra com o domínio. “Pode não ter” e “ainda não foi cadastrado” podem exigir decisões diferentes no produto.

### Classes, operações e composição

**Pergunta:** Que responsabilidades pertencem ao documento e quais pertencem ao armazenamento?

<!-- diagram-example: class-domain family=class -->
<!-- example-compatibility: class-domain -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
classDiagram
  class Note {
    +String id
    +String title
    +revise(content) Revision
  }
  class Revision {
    +String hash
    +String content
  }
  class Storage {
    <<interface>>
    +read(path) Note
    +save(note) Revision
  }
  class BrowserStorage
  class GitStorage
  Note "1" *-- "1..*" Revision : history
  Storage <|.. BrowserStorage
  Storage <|.. GitStorage
  Note ..> Storage : persists through
```

**Leia assim:** A composição liga Note a Revision. Storage é um contrato; os adaptadores realizam esse contrato sem mudar a responsabilidade da nota.

**Adapte:** Mantenha métodos pequenos e relevantes para a conversa. Este modelo orienta o design e não pretende espelhar cada classe do código atual.

### Herança, agregação, associação e dependência

**Pergunta:** Quando uma relação significa especialização e quando significa apenas uso?

<!-- diagram-example: class-relations family=class -->
<!-- example-compatibility: class-relations -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
classDiagram
  Document <|-- Report : specializes
  Collection "1" o-- "0..*" Document : groups
  Reviewer "1" --> "0..*" Document : reviews
  ExportService ..> Document : reads
  class Document {
    <<abstract>>
    +String title
    +render() String
  }
```

**Leia assim:** Report especializa Document. Collection agrega documentos; Reviewer se associa a eles; ExportService depende do contrato de documento.

**Adapte:** Escolha a relação pela semântica, não pela aparência da seta. Composição sugere um vínculo de ciclo de vida mais forte que agregação.

### Requisitos rastreáveis até sua verificação

**Pergunta:** Como relacionar uma promessa de produto a um teste verificável?

<!-- diagram-example: requirements-evidence family=requirement -->
<!-- example-compatibility: requirements-evidence -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
requirementDiagram
  requirement PreserveDraft {
    id: REQ_01
    text: Preserve unsaved note after reload
    risk: high
    verifymethod: test
  }
  element DraftStore {
    type: component
  }
  element ReloadTest {
    type: browser_test
  }
  DraftStore - satisfies -> PreserveDraft
  ReloadTest - verifies -> PreserveDraft
```

**Leia assim:** Um elemento de teste verifica o requisito; um componente o satisfaz. Os identificadores permitem ligar a conversa ao backlog.

**Adapte:** Substitua a descrição por um critério observável e indique o teste real. A ligação “satisfies” é uma afirmação a comprovar.

### Mapa mental para decompor uma pergunta

**Pergunta:** Quais dimensões uma investigação precisa considerar antes da coleta?

<!-- diagram-example: mindmap-context family=mindmap -->
<!-- example-compatibility: mindmap-context -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
mindmap
  root((Contexto de pesquisa))
    Pergunta
      Escopo territorial
      Horizonte temporal
    Atores
      Instituições
      Pessoas afetadas
    Evidências
      Fontes primárias
      Contrapontos
    Entregas
      Síntese
      Lacunas abertas
```

**Leia assim:** Os ramos organizam dimensões, atores, evidências e entregas. A proximidade visual representa hierarquia de ideias, sem quantificar causalidade.

**Adapte:** Use expressões curtas e mova relações entre ramos para um fluxograma ou grafo de entidades quando a hierarquia deixar de explicar o problema.

### Árvore de arquivos e convenções de organização

**Pergunta:** Como explicar a estrutura de um acervo que será compartilhado?

<!-- diagram-example: tree-files family=treeView -->
<!-- example-compatibility: tree-files -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
treeView-beta
├── notes/
│   ├── context.md
│   ├── evidence.md
│   └── decisions.md
├── assets/
│   ├── source-table.png
│   └── field-photo.jpg
└── exports/
    └── research-package.zip
```

**Leia assim:** A árvore separa notas, anexos e exportações. Os caminhos são exemplos de organização, não instruções para criar arquivos automaticamente.

**Adapte:** Troque os nomes pelos caminhos reais do projeto. Esta variação evita ícones externos para continuar autocontida.

### Railroad com combinadores de gramática

**Pergunta:** Como mostrar os componentes permitidos em uma referência para outra nota?

<!-- diagram-example: railroad-combinators family=railroad -->
<!-- example-compatibility: railroad-combinators -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
railroad-beta
title Referência para uma seção
reference = sequence(nonterminal("note"), optional(sequence(terminal("#"), nonterminal("heading")))) ;
note = oneOrMore(nonterminal("letter")) ;
heading = oneOrMore(nonterminal("letter")) ;
letter = choice(terminal("a"), terminal("b"), terminal("c")) ;
```

**Leia assim:** A sequência contém um nome de nota e um fragmento opcional. O desvio do desenho representa a opcionalidade, não uma falha.

**Adapte:** Descreva primeiro a gramática como texto e teste entradas válidas e inválidas. Este exemplo é um contrato hipotético.

### A mesma ideia em EBNF

**Pergunta:** Como representar uma gramática descrita com alternativas e repetição EBNF?

<!-- diagram-example: railroad-ebnf family=railroad -->
<!-- example-compatibility: railroad-ebnf -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
railroad-ebnf-beta
title Referência em EBNF
reference = name, [ "#", name ] ;
name = letter, { letter } ;
letter = "a" | "b" | "c" ;
```

**Leia assim:** Colchetes indicam parte opcional; chaves indicam repetição. A regra reference mantém o fragmento opcional.

**Adapte:** Amplie o alfabeto para o domínio real e documente escapes e Unicode. Os três caracteres servem somente para manter o exemplo legível.

### ABNF para um contrato textual

**Pergunta:** Como documentar uma referência usando uma notação comum em protocolos?

<!-- diagram-example: railroad-abnf family=railroad -->
<!-- example-compatibility: railroad-abnf -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
railroad-abnf-beta
title Referência em ABNF
reference = name [ "#" name ] ;
name = 1*ALPHA ;
```

**Leia assim:** 1*ALPHA exige uma ou mais letras. A parte entre colchetes mantém o destino de seção opcional.

**Adapte:** ABNF e EBNF têm convenções diferentes. Preserve a notação do contrato original ao gerar o desenho.

### PEG para alternativas ordenadas

**Pergunta:** Como representar um parser cuja escolha depende da ordem das alternativas?

<!-- diagram-example: railroad-peg family=railroad -->
<!-- example-compatibility: railroad-peg -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
railroad-peg-beta
title Referência em PEG
Reference <- Name ("#" Name)? ;
Name <- Letter+ ;
Letter <- "a" / "b" / "c" ;
```

**Leia assim:** A regra Name aceita uma ou mais letras; Reference permite o fragmento opcional. PEG usa escolha ordenada, diferente de uma simples lista de opções.

**Adapte:** Quando as alternativas compartilham prefixos, revise a ordem. Um diagrama ajuda a conversar sobre o contrato, mas não substitui testes do parser.

## Arquitetura e integração

### Blocos para uma composição espacial

**Pergunta:** Quais áreas uma tela de consulta precisa reservar?

<!-- diagram-example: block-layout family=block -->
<!-- example-compatibility: block-layout -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
block-beta
  columns 3
  Header["Busca e ações"]:3
  Navigation["Notas"] Reading["Documento"]:2
  Footer["Estado e estatísticas"]:3
```

**Leia assim:** A grade posiciona navegação, documento e contexto. A largura de dois blocos para a leitura comunica prioridade espacial.

**Adapte:** Use blocos para discutir proporções e adjacências. Para a interface final, valide o layout com conteúdo e tamanhos de tela reais.

### Arquitetura de serviços e dependências

**Pergunta:** Quais componentes sustentam um acervo de pesquisa conectado?

<!-- diagram-example: architecture-services family=architecture -->
<!-- example-compatibility: architecture-services -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
architecture-beta
  group workspace(cloud)[Acervo Aurora]
  service api(server)[Consulta] in workspace
  service metadata(database)[Metadados] in workspace
  service files(disk)[Documentos] in workspace
  api:R -- L:metadata
  api:B -- T:files
```

**Leia assim:** Os serviços estão dentro de uma fronteira e se ligam por portas do desenho. Banco e arquivos representam responsabilidades diferentes.

**Adapte:** Use os ícones locais conhecidos pelo Mermaid. Este sistema é hipotético e não descreve onde o Scriba público guarda as notas.

### C4 contexto: pessoas e sistemas vizinhos

**Pergunta:** Qual é a fronteira do sistema e quem interage com ele?

<!-- diagram-example: c4-context family=c4 -->
<!-- example-compatibility: c4-context -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
C4Context
  title Contexto do Acervo Aurora
  Person(analyst, "Analista", "Investiga uma pergunta")
  System(workspace, "Acervo Aurora", "Organiza evidências e sínteses")
  System_Ext(sources, "Fontes primárias", "Publicam documentos verificáveis")
  Rel(analyst, workspace, "Consulta e organiza")
  Rel(workspace, sources, "Referencia")
```

**Leia assim:** O foco é o acervo como um sistema único. Os vizinhos são fontes e usuários, sem entrar nos detalhes de implantação.

**Adapte:** Comece pelo contexto antes de desenhar componentes. A implementação C4 do Mermaid tem sintaxe e layout próprios, com cobertura a verificar.

### C4 containers: responsabilidades executáveis

**Pergunta:** Quais partes executáveis compõem o sistema hipotético?

<!-- diagram-example: c4-container family=c4 -->
<!-- example-compatibility: c4-container -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
C4Container
  title Containers do Acervo Aurora
  Person(analyst, "Analista")
  System_Boundary(workspace, "Acervo Aurora") {
    Container(web, "Consulta web", "Navegador", "Apresenta dossiês")
    Container(api, "API de consulta", "HTTP", "Resolve consultas")
    ContainerDb(store, "Acervo", "Armazenamento", "Mantém referências")
  }
  Rel(analyst, web, "Consulta")
  Rel(web, api, "Solicita referências", "HTTPS")
  Rel(api, store, "Lê metadados")
```

**Leia assim:** Containers representam unidades de aplicação e dados, não obrigatoriamente containers Docker. O navegador usa uma API que consulta o acervo.

**Adapte:** Nomeie tecnologia e responsabilidade de cada unidade. Evite transformar este nível em uma lista de bibliotecas.

### C4 componentes: dividir uma responsabilidade interna

**Pergunta:** Como uma API hipotética separa validação e consulta?

<!-- diagram-example: c4-component family=c4 -->
<!-- example-compatibility: c4-component -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
C4Component
  title Componentes de consulta
  Container_Boundary(api, "API de consulta") {
    Component(entry, "Entrada HTTP", "Handler", "Recebe consultas")
    Component(check, "Validação", "Contrato", "Verifica parâmetros")
    Component(search, "Busca", "Serviço", "Localiza referências")
  }
  Rel(entry, check, "Valida")
  Rel(check, search, "Encaminha consulta válida")
```

**Leia assim:** Os componentes estão dentro da fronteira da API. A sequência de ligações aponta a responsabilidade de cada parte.

**Adapte:** Detalhe um container por vez. Mantenha estável o significado dos nomes usados no diagrama de containers.

### C4 dinâmico: uma interação numerada

**Pergunta:** Como os participantes colaboram em uma consulta específica?

<!-- diagram-example: c4-dynamic family=c4 -->
<!-- example-compatibility: c4-dynamic -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
C4Dynamic
  title Abrir um dossiê no sistema hipotético
  Person(analyst, "Analista")
  Container(web, "Consulta web", "Navegador")
  Container(api, "API", "HTTP")
  Rel(analyst, web, "Abre dossiê")
  Rel(web, api, "Solicita metadados")
  Rel(api, web, "Entrega referências")
```

**Leia assim:** Este recorte é de uma interação concreta, não um mapa de todas as dependências possíveis.

**Adapte:** Use a mesma identificação dos outros níveis C4 e concentre o desenho em um único cenário.

### C4 implantação: onde cada parte executa

**Pergunta:** Em quais ambientes estão navegador e serviço de consulta?

<!-- diagram-example: c4-deployment family=c4 -->
<!-- example-compatibility: c4-deployment -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
C4Deployment
  title Implantação hipotética do Acervo Aurora
  Deployment_Node(device, "Dispositivo da analista", "Computador") {
    Container(web, "Consulta web", "Navegador", "Apresenta o dossiê")
  }
  Deployment_Node(cloud, "Ambiente de consulta", "Serviço remoto") {
    Container(api, "API", "HTTP", "Responde consultas públicas")
  }
  Rel(web, api, "Consulta metadados", "HTTPS")
```

**Leia assim:** Os nós representam ambientes de execução. A existência de um nó de nuvem neste exemplo não implica que o Scriba envie notas ao servidor.

**Adapte:** Acrescente região, rede e responsabilidade somente quando forem informações confirmadas da implantação que você está documentando.

### Pacote binário: campos e intervalos de bits

**Pergunta:** Como explicar o cabeçalho de um protocolo experimental?

<!-- diagram-example: packet-envelope family=packet -->
<!-- example-compatibility: packet-envelope -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
packet-beta
  0-7: "Versão"
  8-15: "Tipo de mensagem"
  16-31: "Tamanho do conteúdo"
  32-63: "Identificador de revisão"
```

**Leia assim:** Os intervalos incluem as duas extremidades: 0–7 contém oito bits. Os campos ocupam posições explícitas.

**Adapte:** Declare unidade, ordem de bytes e tamanho total no contrato. Este cabeçalho é fictício e não é o protocolo do Scriba.

### Fluxo de agentes com referência e revisão humana

**Pergunta:** Como representar uma automação que consulta fontes e mantém uma etapa de revisão?

<!-- diagram-example: agentflow-review family=agentflow -->
<!-- example-compatibility: agentflow-review -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
agentflow-beta LR
  question["Pergunta"]@{ shape: input }
  flow research["Pesquisa assistida"]
    gather["Reunir evidências"]@{ shape: task }
    catalog["Consultar catálogo"]@{ shape: tool }
    protocol["Protocolo de fontes"]@{ shape: refdoc }
    gather --> catalog
    gather -.- protocol
  end
  human["Revisão humana"]@{ shape: decision }
  deliver["Registrar síntese aprovada"]@{ shape: action }
  question --> research --> human
  human --> deliver
```

**Leia assim:** task, tool e refdoc distinguem trabalho, ferramenta e material de consulta. A saída chega à revisão humana antes da entrega.

**Adapte:** Trate metadados de ferramentas como documentação. O diagrama não executa agentes, não conecta serviços e não concede permissões.

## Planejamento e evolução

### Gantt com dependência, responsável e marco

**Pergunta:** Como planejar uma rodada de pesquisa com dependências explícitas?

<!-- diagram-example: gantt-research family=gantt -->
<!-- example-compatibility: gantt-research -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
gantt
  title Rodada ilustrativa de pesquisa
  dateFormat YYYY-MM-DD
  excludes weekends
  section Preparação
    Definir pergunta :done, scope, 2027-02-01, 2d
  section Evidências
    Coletar fontes :active, collect, after scope, 4d
    Revisar referências :crit, review, after collect, 2d
  section Entrega
    Publicar dossiê :milestone, delivery, after review, 0d
```

**Leia assim:** A revisão começa após a coleta; a entrega é um marco de duração zero. As datas são fictícias.

**Adapte:** Troque datas, duração e calendário pelos dados do projeto. Uma barra não demonstra avanço real sem um processo de atualização.

### Gantt com frentes paralelas

**Pergunta:** Quais trilhas podem avançar em paralelo antes da validação conjunta?

<!-- diagram-example: gantt-parallel family=gantt -->
<!-- example-compatibility: gantt-parallel -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
gantt
  title Trilhas paralelas de preparação
  dateFormat YYYY-MM-DD
  section Conteúdo
    Revisar corpus :content, 2027-03-01, 3d
  section Experiência
    Observar uso :experience, 2027-03-01, 3d
  section Integração
    Comparar achados :merge, 2027-03-04, 2d
    Fechar rodada :milestone, after merge, 0d
```

**Leia assim:** As duas trilhas começam na mesma data. O marco final depende de uma tarefa de integração, que deve refletir a dependência real.

**Adapte:** Explicite no texto quem decide o encerramento de cada trilha. O exemplo usa uma integração com início fixo para manter o recorte curto.

### Linha do tempo de decisões e aprendizados

**Pergunta:** Qual foi a sequência de descobertas que mudou a direção do trabalho?

<!-- diagram-example: timeline-learning family=timeline -->
<!-- example-compatibility: timeline-learning -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
timeline
  title Evolução ilustrativa de uma investigação
  section Exploração
    Semana 1 : Definição do problema : Primeiras referências
    Semana 2 : Lacuna de dados identificada
  section Consolidação
    Semana 3 : Hipóteses revisadas : Contrapontos incorporados
    Semana 4 : Síntese entregue : Perguntas abertas registradas
```

**Leia assim:** Cada período agrupa acontecimentos. A linha do tempo organiza cronologia sem representar duração de tarefas.

**Adapte:** Use datas verificadas e cite os registros correspondentes. Para dependências e duração, prefira Gantt.

### Kanban para um backlog de conhecimento

**Pergunta:** Quais perguntas estão aguardando coleta, revisão ou conclusão?

<!-- diagram-example: kanban-backlog family=kanban -->
<!-- example-compatibility: kanban-backlog -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
kanban
  planned[Planejado]
    scope[Delimitar a pergunta]
  collecting[Coletando]
    sources[Localizar fonte primária]@{ priority: 'High' }
  reviewing[Em revisão]
    claims[Conferir duas afirmações]
  complete[Concluído]
    glossary[Registrar glossário]
```

**Leia assim:** As colunas são estados de trabalho; os cartões são perguntas ou entregas. A movimentação pertence ao processo de trabalho, não ao diagrama estático.

**Adapte:** Defina o critério de entrada e saída de cada coluna. Os metadados são ilustrativos e não criam tickets em outro sistema.

### Histórico de uma contribuição revisada

**Pergunta:** Como uma proposta é desenvolvida em uma branch e incorporada à linha principal?

<!-- diagram-example: git-review family=gitGraph -->
<!-- example-compatibility: git-review -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
gitGraph
  commit id: "escopo"
  branch research
  checkout research
  commit id: "fontes"
  commit id: "revisao"
  checkout main
  merge research
  commit id: "entrega" tag: "dossie-v1"
```

**Leia assim:** Os commits pertencem às suas branches; merge reúne o trabalho. O desenho é uma narrativa de histórico, não uma operação Git.

**Adapte:** Use identificadores curtos e uma legenda que explique marcos. O exemplo não executa checkout, merge nem push.

### Branches de manutenção e evolução

**Pergunta:** Como distinguir uma correção pontual de uma frente de evolução?

<!-- diagram-example: git-maintenance family=gitGraph -->
<!-- example-compatibility: git-maintenance -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
gitGraph
  commit id: "base" tag: "v1"
  branch correction
  commit id: "corrigir-citacao" type: HIGHLIGHT
  checkout main
  branch evolution
  commit id: "nova-secao"
  checkout main
  merge correction
  merge evolution
  commit id: "consolidar" tag: "v2"
```

**Leia assim:** Cada branch apresenta uma intenção diferente. As fusões registram os dois percursos sem simular comandos reais.

**Adapte:** Use tags para marcos publicados e nomes de commits que expliquem o efeito. Compare o desenho ao log real antes de usá-lo como evidência.

## Métricas e conjuntos

### Composição de um corpus com categorias exclusivas

**Pergunta:** Qual fração dos cem documentos pertence a cada categoria principal?

<!-- diagram-example: pie-corpus family=pie -->
<!-- example-compatibility: pie-corpus -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
pie showData
  title Corpus ilustrativo de 100 documentos
  "Relatórios públicos" : 45
  "Normas" : 30
  "Estudos acadêmicos" : 25
```

**Leia assim:** Os valores somam cem documentos e as categorias são exclusivas neste recorte fictício. A pizza comunica composição de um total.

**Adapte:** Declare denominador, unidade e período. Se um documento puder pertencer a mais de uma categoria, uma pizza simples pode duplicar o total.

### Quadrantes para discutir prioridade

**Pergunta:** Quais melhorias combinam impacto esperado e esforço relativo?

<!-- diagram-example: quadrant-priority family=quadrantChart -->
<!-- example-compatibility: quadrant-priority -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
quadrantChart
  title Hipóteses de prioridade
  x-axis Menor esforço --> Maior esforço
  y-axis Menor impacto --> Maior impacto
  quadrant-1 Planejar investimento
  quadrant-2 Experimentar primeiro
  quadrant-3 Manter simples
  quadrant-4 Revisar hipótese
  Busca contextual: [0.35, 0.80]
  Novo conector: [0.85, 0.75]
  Ajuste de rótulos: [0.15, 0.25]
```

**Leia assim:** Cada ponto tem coordenadas entre zero e um. As avaliações são hipóteses da equipe e precisam ser calibradas com evidências.

**Adapte:** Defina as duas escalas antes de pontuar. Um quadrante ajuda a deliberar; não determina a decisão sozinho.

### Barras para comparar contagens

**Pergunta:** Quantas evidências foram revisadas em cada rodada?

<!-- diagram-example: xy-bars family=xychart -->
<!-- example-compatibility: xy-bars -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
xychart-beta
  title "Evidências revisadas por rodada"
  x-axis [R1, R2, R3, R4]
  y-axis "Documentos" 0 --> 80
  bar [25, 40, 60, 72]
```

**Leia assim:** As barras comparam contagens discretas. O eixo vertical começa em zero, evitando ampliar artificialmente diferenças pequenas.

**Adapte:** Troque os valores pelo dado medido e mantenha a unidade no eixo. As quatro rodadas são um conjunto ilustrativo.

### Linha para acompanhar uma evolução

**Pergunta:** Como a cobertura de fontes mudou ao longo de quatro semanas?

<!-- diagram-example: xy-line family=xychart -->
<!-- example-compatibility: xy-line -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
xychart-beta
  title "Cobertura ilustrativa de fontes"
  x-axis [S1, S2, S3, S4]
  y-axis "Cobertura percentual" 0 --> 100
  line [20, 45, 70, 85]
```

**Leia assim:** A linha liga observações temporais da mesma métrica. A escala é percentual, de zero a cem.

**Adapte:** Informe como a cobertura é calculada e conserve o mesmo denominador entre os períodos. A linha não comprova causalidade.

### Barras e linha na mesma unidade

**Pergunta:** Como comparar recebimento e revisão usando a mesma escala?

<!-- diagram-example: xy-combined family=xychart -->
<!-- example-compatibility: xy-combined -->
**Motores verificados:** Mermaid · Pele · Beautiful Mermaid.

```mermaid
xychart-beta
  title "Entrada e revisão de documentos"
  x-axis [R1, R2, R3, R4]
  y-axis "Documentos" 0 --> 80
  bar [50, 65, 70, 75]
  line [25, 40, 60, 72]
```

**Leia assim:** As barras são recebimentos e a linha é revisão. Ambos medem documentos por rodada e usam a mesma unidade.

**Adapte:** Explique a legenda no texto, pois a apresentação varia entre motores. Para unidades distintas, separe os gráficos em vez de sugerir equivalência.

### Radar para um perfil de critérios

**Pergunta:** Como duas propostas se distribuem nos mesmos critérios de avaliação?

<!-- diagram-example: radar-quality family=radar -->
<!-- example-compatibility: radar-quality -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
radar-beta
  title Comparação ilustrativa de propostas
  axis clarity["Clareza"], evidence["Evidência"], access["Acesso"], maintenance["Manutenção"]
  curve first["Proposta A"]{4, 5, 3, 4}
  curve second["Proposta B"]{3, 4, 5, 3}
  min 0
  max 5
  graticule polygon
```

**Leia assim:** Cada eixo usa a mesma escala de zero a cinco. As curvas mostram perfis fictícios; sua área não deve ser tratada como uma nota composta.

**Adapte:** Documente a rubrica de cada eixo. A ordem dos critérios influencia o polígono e deve ser mantida nas comparações.

### Sankey para fluxos quantitativos conservados

**Pergunta:** Para onde foram os 120 documentos recebidos na triagem?

<!-- diagram-example: sankey-triage family=sankey -->
<!-- example-compatibility: sankey-triage -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
sankey-beta
"Recebidos","Elegiveis",80
"Recebidos","Descartados",25
"Recebidos","Pendentes",15
"Elegiveis","Revisados",60
"Elegiveis","Aguardando revisao",20
```

**Leia assim:** A entrada se divide em 80 elegíveis, 25 descartados e 15 pendentes. Os 80 elegíveis se dividem em 60 revisados e 20 aguardando revisão.

**Adapte:** Confira a conservação das quantidades nos pontos de divisão. Use a mesma unidade em todas as ligações.

### Treemap para composição hierárquica

**Pergunta:** Como o tamanho de um acervo se distribui por tema e subtema?

<!-- diagram-example: treemap-acervo family=treemap -->
<!-- example-compatibility: treemap-acervo -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
treemap-beta
"Acervo ilustrativo"
  "Instituições"
    "Regulação": 30
    "Financiamento": 20
  "Território"
    "Infraestrutura": 25
    "População": 15
  "Método"
    "Referências": 10
```

**Leia assim:** As áreas representam quantidades nas folhas. Os níveis agrupam temas, sem acrescentar outro total independente aos pais.

**Adapte:** Use valores positivos da mesma unidade e explique o período. Rótulos curtos ajudam quando algumas áreas ficam pequenas.

### Venn para interseções qualitativas

**Pergunta:** Quais evidências são relevantes, verificáveis e atuais ao mesmo tempo?

<!-- diagram-example: venn-evidence family=venn -->
<!-- example-compatibility: venn-evidence -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
venn-beta
  title Critérios de inclusão no dossiê
  set Relevante
  set Verificavel["Verificável"]
  set Atual
  union Relevante,Verificavel["Sustentada"]
  union Relevante,Atual["Oportuna"]
  union Verificavel,Atual["Atualizada"]
  union Relevante,Verificavel,Atual["Priorizar revisão"]
```

**Leia assim:** As interseções recebem rótulos para explicitar o que a combinação de critérios significa. A área do desenho não representa cardinalidade.

**Adapte:** Use a interseção para discutir critérios de inclusão. Para contar itens, acompanhe o desenho com uma tabela e uma regra de classificação.

## Decisões e aprendizado

### Comando, evento e interface ao longo do tempo

**Pergunta:** O que alguém solicita e qual fato de domínio é registrado depois?

<!-- diagram-example: events-command family=eventmodeling -->
<!-- example-compatibility: events-command -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
eventmodeling
  tf 01 ui EvidenceForm
  tf 02 cmd RegisterEvidence { sourceId: string }
  tf 03 evt EvidenceRegistered { evidenceId: string }
```

**Leia assim:** cmd representa a intenção; evt representa um fato ocorrido. ui situa a interação em que a solicitação aparece.

**Adapte:** Nomeie eventos no passado e comandos como ações. Este recorte não implementa event sourcing no produto.

### Evento, modelo de leitura e consulta

**Pergunta:** Como um fato registrado sustenta uma visão consultável?

<!-- diagram-example: events-projection family=eventmodeling -->
<!-- example-compatibility: events-projection -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
eventmodeling
  tf 01 evt EvidenceReviewed
  tf 02 rmo ReviewedEvidenceIndex
  tf 03 ui ResearchDashboard
```

**Leia assim:** rmo é um modelo de leitura. O desenho separa o evento ocorrido da projeção usada para consulta.

**Adapte:** Documente atraso aceitável e regras de reconstrução se o sistema real usar projeções. O exemplo mostra uma linguagem de design.

### Ishikawa para explorar causas possíveis

**Pergunta:** Quais hipóteses podem explicar o atraso na revisão de um dossiê?

<!-- diagram-example: ishikawa-delay family=ishikawa -->
<!-- example-compatibility: ishikawa-delay -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
ishikawa-beta
  Revisão do dossiê atrasada
  Processo
    Critério de aceite pouco claro
    Muitas devoluções
  Informação
    Fonte sem identificação
    Data da evidência ausente
  Pessoas
    Capacidade de revisão limitada
  Ferramentas
    Busca pouco precisa
    Duplicatas difíceis de localizar
```

**Leia assim:** As espinhas agrupam hipóteses por processo, informação, pessoas e ferramentas. Cada item ainda precisa de verificação.

**Adapte:** Transforme as causas propostas em perguntas investigáveis. O desenho organiza hipóteses e não estabelece causalidade por si só.

### Wardley para discutir capacidades e evolução

**Pergunta:** Quais capacidades sustentam a experiência de leitura e como podem evoluir?

<!-- diagram-example: wardley-capabilities family=wardley -->
<!-- example-compatibility: wardley-capabilities -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
wardley-beta
title Capacidades de um acervo de pesquisa
anchor "Leitura confiável" [0.95, 0.60]
component "Síntese contextual" [0.78, 0.35]
component "Evidências curadas" [0.58, 0.50]
component "Armazenamento" [0.22, 0.85]
"Leitura confiável" -> "Síntese contextual"
"Síntese contextual" -> "Evidências curadas"
"Evidências curadas" -> "Armazenamento"
evolve "Síntese contextual" 0.55
note "Padronizar critérios antes de automatizar" [0.42, 0.25]
```

**Leia assim:** As dependências partem da necessidade da pessoa. As posições são hipóteses de visibilidade e maturidade, não medições automáticas.

**Adapte:** Valide os eixos com a equipe e justifique as posições. O mapa orienta uma conversa estratégica, sem determinar uma solução técnica.

### Cynefin para escolher uma abordagem de investigação

**Pergunta:** A situação pede procedimento conhecido, análise especializada, experimento ou contenção?

<!-- diagram-example: cynefin-decisions family=cynefin -->
<!-- example-compatibility: cynefin-decisions -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
cynefin-beta
  title Abordagens para problemas de pesquisa
  clear
    "Aplicar checklist de referência"
  complicated
    "Revisar uma metodologia especializada"
  complex
    "Experimentar uma nova forma de curadoria"
  chaotic
    "Conter exposição de um dado sensível"
  confusion
    "Delimitar um incidente ainda desconhecido"
```

**Leia assim:** Os domínios organizam situações com graus diferentes de entendimento. As classificações são propostas para discussão.

**Adapte:** Revise o enquadramento quando surgirem evidências. Complexo não é sinônimo de complicado, e o desenho não substitui julgamento contextual.

## Diagnóstico

### Identificar o renderizador

**Pergunta:** Qual motor está desenhando este bloco?

<!-- diagram-example: renderer-info family=info -->
<!-- example-compatibility: renderer-info -->
**Motores verificados:** Mermaid · Pele. Beautiful Mermaid não renderiza este exemplo.

```mermaid
info
```

**Leia assim:** info é um diagnóstico do renderizador e pode apresentar informações diferentes conforme o motor selecionado.

**Adapte:** Use este bloco ao relatar diferenças de comportamento, junto da versão do aplicativo e de um exemplo mínimo reproduzível.

## Limites e portabilidade

**ZenUML** é uma extensão própria e não está registrada nesta distribuição do Scriba. Para representar uma interação aqui, use os exemplos `sequenceDiagram`. A referência oficial explica a instalação separada: [ZenUML](https://mermaid.js.org/syntax/zenuml.html).

Um bloco com o nome de outra linguagem, como DOT/Graphviz, PlantUML ou D2, permanece como código: estes renderizadores não estão integrados à plataforma. A presença de um nome no texto não instala sua implementação.

Se um exemplo não for aceito pelo motor alternativo, mantenha o seletor disponível e escolha Mermaid. Um erro de sintaxe pertence ao bloco e não deve impedir a leitura do restante da nota. Para relatar um problema, copie o bloco mínimo, a versão do Scriba, o motor escolhido e a mensagem apresentada.

Este arquivo é uma nota normal: você pode copiar, exportar, editar ou desafixar sua cópia. A distribuição adiciona a referência uma vez; reabrir o aplicativo não deve apagar suas alterações nem recriar uma cópia que você decidiu remover.

## Fontes e manutenção

Sintaxe consultada na documentação oficial da versão `mermaid@12.2.0`, acompanhada de verificação dos exemplos no renderizador do próprio Scriba. Conteúdo e cenários são originais desta referência. A matriz registra o resultado observado nas versões fixadas, sem generalizar cobertura total de uma família.

- [Catálogo e sintaxe do Mermaid](https://mermaid.js.org/intro/syntax-reference.html)
- [Documentação versionada do Mermaid 12.2.0](https://github.com/mermaid-js/mermaid/tree/mermaid%4012.2.0/packages/mermaid/src/docs/syntax)
- [Pele: documentação e implementação](https://github.com/obsidianmd/pele)
- [Beautiful Mermaid: famílias e configuração](https://github.com/lukilabs/beautiful-mermaid)

A próxima revisão deve preservar os identificadores dos exemplos, testar novamente os blocos e atualizar a matriz quando mudar uma dependência. Os exemplos servem como corpus de regressão do produto para sintaxe, legibilidade, seleção de motor, tema, lupa e navegação.

Powered by **Aeon Bridge Co.** — offered to community.
