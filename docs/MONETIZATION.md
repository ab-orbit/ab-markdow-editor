# Scriba — análise de monetização e recursos premium

Data: 22 de outubro de 2026. Status: proposta de produto para validação; não representa funcionalidades disponíveis, preços definidos ou alteração do aplicativo publicado.

## Recomendação central

Manter o Scriba gratuito como editor completo e oferecer duas propostas comerciais complementares:

- **Compra única:** ferramentas profissionais que ampliam a produção local e entregam um desbloqueio durável.
- **Assinatura:** serviços contínuos de sincronização, proteção, hospedagem, colaboração e processamento com valor recorrente perceptível.

A promessa proposta é: **“Você compra ferramentas para produzir melhor e assina serviços para manter seu trabalho conectado e protegido.”**

O objetivo é monetizar resultados desejados, preservando a confiança de quem usa o Scriba para guardar suas ideias. As prioridades abaixo são hipóteses de alto potencial de desejo, ainda sem pesquisa própria suficiente para afirmar disposição a pagar ou conversão.

## Ponto de partida

O Scriba já oferece edição e leitura de Markdown, notas locais, diagramas, whiteboard, integração opcional com GitHub e exportações. A proposta preserva essas capacidades na oferta gratuita, em vez de transformar recursos já entregues em limitações artificiais.

A sincronização própria proposta seria uma nova experiência gerenciada e opcional. Ela não substitui nem transforma a integração GitHub existente em um recurso pago.

No ecossistema Apple, assinatura também é uma compra in-app. Neste documento, **compra única** significa um produto não consumível: comprado uma vez, sem expirar ou diminuir com o uso. [Tipos de compra in-app da Apple](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types/)

## Recursos que podem justificar assinatura

A prioridade expressa a ordem sugerida para investigar e validar, não um compromisso de implementação.

| Prioridade | Recurso proposto | Entrega concreta | Desejo e justificativa de recorrência |
|---|---|---|---|
| 1 | **Scriba Sync** | Sincronização própria entre dispositivos, criptografia ponta a ponta, recuperação de versões e lixeira | “Minhas notas estão seguras e sempre comigo.” Remove a necessidade de configurar GitHub e mantém proteção e disponibilidade contínuas. |
| 2 | **Publicação profissional** | Converter notas em sites, documentação ou portfólio, com domínio próprio, busca e páginas privadas | Publicar e compartilhar trabalho sem manter uma infraestrutura própria. Hospedagem e disponibilidade continuam entregando valor após a publicação. |
| 3 | **Pesquisa sobre o próprio acervo** | Perguntas sobre notas e PDFs, com respostas referenciadas aos trechos originais | Encontrar e reutilizar conhecimento acumulado. O acervo cresce e exige indexação e processamento contínuos. |
| 4 | **Reuniões que viram trabalho** | Transcrição, resumo, decisões e tarefas vinculadas às notas | Reduzir o trabalho de transformar reuniões em ações. A oferta deve informar uma franquia clara de minutos e os limites de processamento. |
| 5 | **Espaços compartilhados** | Notas e whiteboards em colaboração, comentários, permissões e histórico de autoria | Trabalhar continuamente com equipe, orientador ou cliente, mantendo contexto e responsabilidades. |
| 6 | **Caixa de entrada inteligente** | Captura de páginas, e-mails e documentos, com organização e recuperação no acervo | Reunir material recebido diariamente. Conectores, processamento e operação do serviço exigem manutenção contínua. |

### Primeira aposta: Sync e recuperação

A primeira frente recomendada é sincronização própria com recuperação de versões. A necessidade potencial é ampla, a proposta combina com a preservação das ideias e o benefício pode ser explicado sem depender de uma lista extensa de ferramentas.

A assinatura precisa entregar confiabilidade: sincronização previsível, tratamento de conflitos, restauração compreensível e limites de armazenamento transparentes. Criptografia ponta a ponta é uma capacidade proposta que precisa ser efetivamente projetada e verificada antes de aparecer como promessa comercial.

A segunda frente sugerida é publicação profissional, especialmente para pessoas que produzem documentação, pesquisa, propostas e portfólios. Antes de desenvolver hospedagem própria, validar se os usuários desejam publicar com frequência e quais controles de acesso realmente precisam.

### Limites e custos da oferta recorrente

A definição de preço depende de medir armazenamento, tráfego, retenção de versões, transcrição, processamento de modelos, suporte e custos de distribuição. Este documento não define preços nem margens.

Para pesquisa e transcrição, evitar prometer uso ilimitado sem custos e capacidade demonstrados. Informar franquias, limites, tratamento dos arquivos e quais operações enviam conteúdo para servidores. Recursos baseados em processamento local podem pertencer à compra única; a existência de IA, isoladamente, não justifica uma assinatura.

A Apple exige valor contínuo nas assinaturas e admite sua coexistência com compras avulsas. [Diretriz 3.1.2](https://developer.apple.com/app-store/review/guidelines/)

## Recursos que podem justificar compra única

| Prioridade | Recurso proposto | Entrega concreta | Resultado que o comprador deseja |
|---|---|---|---|
| 1 | **Scriba Publisher** | Diagramação avançada, capa, sumário, cabeçalhos, referências e exportação DOCX, EPUB e PDF profissional | Entregar relatórios, propostas e livros com acabamento, sem refazer a composição em outro aplicativo. |
| 2 | **Modo apresentação** | Converter notas e diagramas em slides, com notas do apresentador e exportação | Apresentar o próprio trabalho sem remontá-lo em outra ferramenta. |
| 3 | **Pesquisa acadêmica** | Biblioteca de referências, integração com Zotero/BibTeX, citações e bibliografia automática | Produzir artigos e trabalhos com menos retrabalho de formatação e referências. |
| 4 | **PDF e digitalização local** | Anotação de documentos, OCR no dispositivo e conversão de trechos em notas com referência à página | Transformar documentos recebidos em material útil e editável. |
| 5 | **Automação local** | Modelos com variáveis, comandos em lote, atalhos e fluxos repetíveis | Produzir documentos frequentes mais rapidamente e com consistência. |
| 6 | **Pacotes profissionais de modelos** | Estruturas para propostas comerciais, pesquisa, arquitetura de software, planejamento e documentação | Começar com um material pronto e útil, com exemplos que ajudam a concluir o trabalho. |

### Pacote Pro, em vez de muitos desbloqueios

Reunir os recursos mais fortes em um pacote **Scriba Pro** tende a tornar a proposta mais compreensível do que uma loja fragmentada em muitos desbloqueios pequenos. A composição inicial sugerida é Publisher, apresentações e automações locais.

Pesquisa acadêmica e ferramentas locais de PDF/OCR são candidatas a evolução do pacote ou a módulos específicos, conforme o público demonstrar interesse. Não assumir que precisam ser produtos separados antes da validação.

Pacotes de modelos podem ser vendidos separadamente quando tiverem profundidade e utilidade próprias. Devem ser autorais ou devidamente licenciados. Não revender como conteúdo exclusivo bibliotecas públicas ou de terceiros que já acompanham o Scriba.

Compra única não deve ser apresentada como garantia de hospedagem, processamento em nuvem ou todos os produtos futuros. A descrição comercial precisa delimitar claramente o desbloqueio adquirido, preservando os direitos de quem comprou.

## Composição comercial inicial sugerida

| Oferta | Modelo | Escopo proposto |
|---|---|---|
| **Scriba gratuito** | Sem cobrança | Preservar notas locais, Markdown, diagramas, whiteboard, GitHub e exportações já oferecidas. |
| **Scriba Pro** | Compra única não consumível | Publisher, apresentações e automações locais. |
| **Scriba Sync** | Assinatura | Sincronização própria, backup e recuperação de versões. |

Publicação, pesquisa sobre o acervo, reuniões e colaboração são oportunidades posteriores. Não precisam ser lançadas simultaneamente nem agrupadas em uma assinatura com custo e mensagem difíceis de explicar.

Caso uma assinatura futura inclua ferramentas também vendidas por compra única, explicar os direitos de cada oferta e evitar induzir compradores a pagar duas vezes pelo mesmo desbloqueio. A assinatura pode oferecer serviços adicionais, enquanto a compra única conserva sua utilidade local.

## O que evitar

- Cobrar por quantidade de notas como principal argumento de diferenciação.
- Bloquear acesso aos próprios arquivos, leitura ou exportações existentes para forçar uma compra.
- Retirar funcionalidades atuais para criar artificialmente o pacote premium.
- Colocar a integração GitHub existente atrás de uma assinatura por causa do novo Sync.
- Justificar recorrência apenas com temas, ícones ou um conjunto estático de modelos.
- Vender uma promessa genérica de IA sem resultado concreto, referências verificáveis ou limites claros.
- Prometer gratuidade permanente ou serviços ilimitados sem decisão e capacidade para sustentá-los.

Estas são recomendações de produto e confiança, não uma afirmação de que todas constituem proibições específicas da Apple.

## Validação antes de definir preço e desenvolver

1. **Identificar segmentos:** investigar quem usa o Scriba para escrita pessoal, pesquisa, documentação profissional e trabalho compartilhado. Não presumir que todos desejam o mesmo pacote.
2. **Investigar situações reais:** pedir exemplos de perda de versões, dificuldades de sincronização, produção de relatórios e preparação de apresentações. Separar inconveniência ocasional de problema frequente com impacto relevante.
3. **Testar propostas concretas:** demonstrar restauração de uma nota, geração de um relatório e conversão em apresentação. Medir interesse em cada resultado, não somente aprovação de uma lista de funcionalidades.
4. **Validar disposição a pagar:** confrontar compra única e assinatura com alternativas que o usuário já utiliza. Só depois definir hipóteses de preço e realizar testes comerciais transparentes.
5. **Medir economia e retenção:** acompanhar ativação, conversão, uso recorrente, cancelamento, reembolso, suporte e custo por usuário pagante. Custo de servidor, isoladamente, não prova valor para o cliente.
6. **Revisar confiança e portabilidade:** definir restauração de compras, comportamento no cancelamento, exportação e acesso aos dados antes de lançar a cobrança. Preservar os arquivos do usuário e comunicar prazos e limites do serviço.

Essas etapas são trabalho recomendado para reduzir incerteza; não foram realizadas nem produziram métricas próprias nesta análise.

## Referências de mercado e interpretação

O Obsidian mantém o editor gratuito e comercializa Sync e Publish como serviços opcionais. Isso sustenta a plausibilidade da separação entre ferramenta local e serviço recorrente, mas não demonstra que usuários do Scriba pagarão pelas mesmas propostas. [Preços e serviços do Obsidian](https://obsidian.md/pricing)

O Goodnotes apresenta opções de compra única e assinatura, com diferenças entre uso local, serviços em nuvem, colaboração e capacidades de processamento. É uma referência de coexistência de modelos, não um preço ou pacote a copiar. [Comparação oficial dos planos Goodnotes](https://support.goodnotes.com/hc/en-us/articles/13808767840015-Compare-Goodnotes-Plans-and-Features)

As referências foram consultadas na conversa de 22 de outubro de 2026. Ofertas de mercado e regras da Apple podem mudar; verificar as páginas oficiais novamente antes de implementar a monetização.

## Decisão ainda aberta

A recomendação inicial é **Scriba gratuito + Pro por compra única + Sync por assinatura**. Nenhum preço, prazo, quota, arquitetura de nuvem ou compromisso de entrega foi aprovado. Esta análise documenta uma direção para pesquisa e planejamento; não modifica a oferta atual nem a submissão da App Store.
