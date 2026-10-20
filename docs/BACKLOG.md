# Scriba — backlog priorizado de produto

Atualizado em: 19 de outubro de 2026.

Avaliação relacionada: [experiência previsível — abrir, ler, editar e salvar](research/predictable-experience-2026-10-19/README.md).

## Objetivo

Tornar o Scriba um editor Markdown completo e excelente para escrever, ler, encontrar e preservar documentos, mantendo a simplicidade de uso. Recursos avançados devem aparecer conforme o contexto, por atalhos ou pela paleta de comandos.

Este backlog considera os recursos existentes: edição visual e fonte, tabelas, notas de rodapé, outline, GitHub, arquivos locais e diagramas.

## Estado e regras

- Todos os itens abaixo são propostas de evolução, ainda sem compromisso de prazo ou início de implementação.
- A ordem indica a prioridade sugerida; os números identificam os itens nesta versão do backlog.
- Cada entrega deve preservar os arquivos Markdown e manter a interface simples em celular, tablet e desktop.
- Um problema crítico identificado durante a avaliação deve ser apresentado ao responsável pelo produto, com a correção proposta, antes de qualquer alteração.

## Backlog

| Ordem | Prioridade | Entrega e resultado esperado | Estado |
|---|---|---|---|
| 1 | Essencial | **Fidelidade do Markdown:** ampliar os testes para garantir que editar visualmente preserve referências, comentários, extensões e trechos não alterados. | Proposto |
| 2 | Essencial | **Sincronização de todas as notas pendentes:** fila persistente, envio ao reconectar e recuperação após fechar o aplicativo. | Proposto |
| 3 | Essencial | **Histórico e restauração:** consultar versões, comparar mudanças e recuperar conteúdo pela interface. | Proposto |
| 4 | Essencial | **Sincronização compreensível:** distinguir “salvo neste dispositivo”, “aguardando envio”, “sincronizado” e “conflito”, por nota. | Proposto |
| 5 | Essencial | **Edição natural consistente:** aperfeiçoar cursor, seleção, colagem, listas, desfazer e teclado virtual nos diferentes dispositivos. | Proposto |
| 6 | Essencial | **Desempenho e acessibilidade:** estabelecer testes com documentos grandes, bibliotecas extensas, leitores de tela e navegação por teclado. | Proposto |
| 7 | Alta | **Busca completa:** pesquisar todo o conteúdo da biblioteca, com resultados destacados e filtros por pasta, data e tipo de conteúdo. | Proposto |
| 8 | Alta | **Localizar e substituir:** funcionar na edição visual e no fonte; opções avançadas recolhidas. | Proposto |
| 9 | Alta | **Organização da biblioteca:** pastas, tags, favoritos e operações para renomear, mover e excluir com recuperação. | Proposto |
| 10 | Alta | **Links entre notas:** autocompletar destinos, apontar para seções, mostrar backlinks e preservar referências ao mover arquivos. | Proposto |
| 11 | Alta | **Abertura rápida e paleta de comandos:** encontrar arquivos e executar ações sem aumentar a barra de ferramentas. | Proposto |
| 12 | Alta | **Continuidade de trabalho:** restaurar documento, posição de leitura e sessão; oferecer abas e documentos lado a lado no desktop. | Proposto |
| 13 | Alta | **Tabelas mais naturais:** navegação entre células, colagem de planilhas e manipulação contextual de linhas e colunas. | Proposto |
| 14 | Alta | **Exportação PDF e HTML:** tipografia consistente, paginação, índice, imagens, tabelas e diagramas preservados. | Proposto |
| 15 | Expansão | **Matemática:** fórmulas inline e em bloco, funcionamento offline e exportação fiel. | Proposto |
| 16 | Expansão | **Código de programação:** destaque para várias linguagens, copiar bloco e alternar quebra de linha. | Proposto |
| 17 | Expansão | **Compatibilidade documentada:** matriz de suporte a CommonMark/GFM e extensões; acrescentar frontmatter e callouts com preservação do fonte. | Proposto |
| 18 | Expansão | **Referências e pesquisa:** melhorar a edição de notas de rodapé e acrescentar bibliografia, citações e integração com Zotero/BibTeX. | Proposto |
| 19 | Expansão | **Imagens e anexos:** gerenciar arquivos utilizados, substituir imagens, editar legendas e identificar referências quebradas. | Proposto |
| 20 | Expansão | **Escrita concentrada:** modo foco, linha de escrita centralizada, metas opcionais e preferências de leitura. | Proposto |
| 21 | Expansão | **Importação e migração:** trazer bibliotecas de outros editores com relatório do conteúdo convertido e preservado. | Proposto |
| 22 | Expansão | **Manual completo e modelos:** estender a referência contextual para todo o Markdown; modelos de artigo, reunião, documentação e pesquisa. | Proposto |
| 23 | Posterior | **Google Drive e outros destinos:** manter uma experiência comum de sincronização, com capacidades explícitas por integração. | Proposto |
| 24 | Posterior | **DOCX e EPUB:** exportação com estilos, referências e estrutura de capítulos. | Proposto |
| 25 | Posterior | **Personalização e distribuição:** novos temas, atalhos configuráveis e expansão para Android, Windows e Linux. | Proposto |
| 26 | Posterior | **Colaboração, extensões e IA opcional:** comentários, revisão compartilhada e automações, após consolidar o núcleo do editor. | Proposto |

## Sequência inicial sugerida

Itens **1–6 → 7–8 → 14**: confiança nos arquivos, escrita consistente, busca completa e documentos prontos para compartilhar.

A sincronização depende das capacidades de cada plataforma. A fila proposta deve retomar o trabalho ao abrir o aplicativo ou recuperar a conexão; sincronização com o aplicativo fechado exige avaliação específica e não está garantida por este backlog.

## Referências de produto consultadas

- [Typora — sintaxe Markdown](https://support.typora.io/Markdown-Reference/)
- [Typora — exportação](https://support.typora.io/Export/)
- [Bear — busca](https://bear.app/faq/how-to-search-notes-in-bear/)
- [iA Writer — escrita concentrada e recursos](https://ia.net/writer/support/basics/features)
- [Obsidian — armazenamento e portabilidade dos arquivos](https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data)
