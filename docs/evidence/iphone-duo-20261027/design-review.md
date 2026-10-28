# Revisão visual e decisões

## Direção

`true-black-flat`, seed `1312350032`, sem novo sorteio, com `palette,type` preservados. A pergunta da tela é **como continuar na mesma nota quando o espaço muda**. O título e o texto da pessoa são dominantes; a biblioteca é contexto adjacente. A tipografia editorial continua sendo a do Scriba, com o sistema Apple nos controles e uma família monoespaçada no código.

O Acervo Aurora é um documento fictício **somente dos testes**. Não foi adicionado à biblioteca de usuários nem ao manual distribuído. As notas de boas-vindas e referência nas capturas pertencem ao produto existente.

## Rodada 1 — achados nas capturas nativas

- O título “Notas” quebrava na biblioteca de 248 pontos. O comando redundante de fechar essa coluna foi retirado e o título preserva uma linha.
- Caixas de tarefas ocupavam 44 pontos visualmente. Mantido o alvo de toque de 44 pontos, com marca de 18 pontos.
- O estado de salvamento desaparecia com a barra web. O rodapé nativo agora mostra “Tudo salvo”, alterações ou sincronização pendente, conforme o estado real.
- Uma importação começava na posição antiga da leitura. O novo arquivo começa no topo; recarregamento e redimensionamento continuam preservando o ponto de leitura.
- Com teclado aberto, o sistema comprimia a navegação vertical e movia “Concluir” para o overflow. A ação passa a vir primeiro durante a edição. A captura anterior está em [before-duo-native-writing-keyboard.png](before-duo-native-writing-keyboard.png).

## Rodada 2 — capturas de redimensionamento e compilação de produção

1. **Hierarquia:** o conteúdo da nota é lido primeiro; a biblioteca tem escala menor. O arquivo continua identificado na navegação.
2. **Alinhamento:** a biblioteca e o documento ocupam suas regiões. Em área estreita, a biblioteca sai do caminho; a tabela mantém colunas legíveis com navegação horizontal, conforme pedido do usuário.
3. **Cor e tipografia:** fundo editorial e títulos azulados existentes; destaque reservado à seleção e às ações. A aparência do UIKit acompanha o sistema.
4. **Contagens:** palavras/caracteres pertencem ao documento; a indicação de salvamento vem do estado do destino. Não há métricas de demonstração na interface.
5. **Zero e ausências:** notas vazias continuam indicando zero; não foram acrescentados badges artificiais.
6. **Colisões:** não houve overflow da página nas cinco larguras do WebKit. Menus usam o limite da própria nota, inclusive com rótulos traduzidos. Diagramas, tabelas e canvas mantêm sua navegação interna.
7. **Celular:** a nota continua inteira e o acesso à biblioteca permanece na navegação. O ajuste do texto usa Dynamic Type e campos de edição têm piso de 16 pontos.

As capturas reais de janelas são [compacta](duo-resize-0.png), [ampla](duo-resize-1.png), [vertical](duo-resize-2.png) e [retorno à compacta](duo-resize-3.png). Elas demonstram redimensionamento de scene; **não demonstram abrir ou fechar a dobradiça**.

## Inspeção automatizada de estilo

O primeiro relatório está em [design-inspection/report.json](design-inspection/report.json). A inspeção da compilação de produção está em [design-production/report.json](design-production/report.json): **0 FAIL e 2 WARN**, com duas exceções explícitas:

- `button-fx`: as barras web existentes mantêm o tratamento visual solicitado anteriormente. No Duo, elas são substituídas por barras UIKit; o material nativo segue o HIG. A inspeção do fallback web não decide o desenho do sistema.
- `edge-text`: o rótulo compacto do botão “Notas” fica a 8 px da borda no fallback desktop; é um controle da biblioteca, não um parágrafo. Seu alvo continua com o tamanho de controle. Não foi alterada toda a interface desktop para satisfazer uma margem genérica do inspetor.

Os avisos de fontes ficam registrados: há três papéis existentes — leitura, sistema e código — preservados por `--keep palette,type`. O inspetor não confirma fontes instaladas no sistema da mesma forma que uma fonte baixada; a revisão visual foi feita nas capturas do macOS/WebKit e do iOS. Não se afirma que a mesma face está instalada em todo navegador.

## Limite desta revisão

A revisão visual de posturas reais, câmera e Split View ainda depende de Device Hub acessível. O Mac bloqueado impediu essa etapa. A versão candidata não recebe o rótulo “pronta para submissão” apenas porque os testes de geometria passaram; a decisão final permanece com o usuário após a validação restante.
