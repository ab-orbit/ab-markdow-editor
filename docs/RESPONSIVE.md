# Validação de celular e tablet

A interface foi validada com toque simulado em Chrome/Blink e WebKit, nas resoluções abaixo, girando a mesma sessão entre as duas orientações sem perder o documento.

| Perfil | Vertical (CSS px) | Horizontal (CSS px) |
| --- | --- | --- |
| Celular pequeno | 320 × 568 | 568 × 320 |
| Celular | 390 × 844 | 844 × 390 |
| Tablet | 768 × 1024 | 1024 × 768 |
| Tablet grande | 820 × 1180 | 1180 × 820 |

## Correções verificadas

O teste inicial reproduziu um defeito no modo Visão: em 320 × 568, um documento longo estendia o painel de texto até aproximadamente 4504 px, empurrando a prévia para fora da tela. Agora os dois painéis têm altura limitada e rolagem independente. Em telas até 899 px eles ficam empilhados; acima disso ficam lado a lado. A lateral pode permanecer aberta em tablets na horizontal.

A barra de ações foi compactada para evitar uma quebra extra de linha em 320 px. Botões de toque têm no mínimo 44 × 44 px; campos dos diálogos usam 16 px. O aviso de imagens fica recolhido em telas estreitas e o aviso temporário de salvamento ocupa menos espaço. O indicador offline não desloca os botões para fora da tela.

A altura do workspace acompanha `visualViewport` quando disponível. A suite reduz a área para 280 px de altura para exercitar edição com pouco espaço disponível, preservando o conteúdo ao restaurar a altura. O cabeçalho do diálogo permanece acessível durante sua rolagem. Isso simula a redução de área; não abre um teclado físico de iOS/Android.

## Fluxos executados em cada perfil e orientação

- Seleção de repositório pela UI, com resposta do seletor nativo simulada; Git e HTTP reais em checkout e remoto temporários.
- Abrir/buscar notas, recolher a lateral e alternar modos.
- Visão com ambos os painéis dentro da tela; edição refletida imediatamente na prévia.
- Rotação sem perda do texto; rolagem da prévia longa; tabelas e blocos de código sem overflow da página.
- Formatação recolhível, preferências, nota de commit, edição/aplicação de tabela e imagens locais.
- Salvar/commit/push, exportar ZIP e conferir texto/imagem no pacote.
- Editar com área reduzida, restaurar altura, salvar e conferir no remoto.
- Editar sem rede, preservar rascunho, manter ações acessíveis e sincronizar ao reconectar.
- Ausência de erros JavaScript e de overflow horizontal/vertical do shell.

A suite completa em Chrome tem 13 jornadas. As 4 jornadas responsivas são repetidas em WebKit: 17 jornadas distintas no total, além de 27 testes HTTP. Os testes responsivos bloqueiam service workers para que a interceptação do seletor nativo seja determinística nos dois motores; o funcionamento de cache/reload offline da PWA é exercitado separadamente pelas jornadas `pwa.spec.ts` no Chrome.

## Reproduzir

```bash
npm run build
npm test
MARKDOWN_BROWSER_CHANNEL=chrome npm run test:e2e
MARKDOWN_BROWSER=webkit npm run test:e2e -- responsive.spec.ts
```

Os motores do Playwright precisam estar instalados. As evidências ficam no [índice de capturas](evidence/RESPONSIVE.md).

## Limites da validação

São testes de motores de navegador com viewport, toque e escala 2× simulados, executados no Mac. Não houve teste em celular/tablet físico, teclado nativo, barras do navegador ou recortes de tela reais. Portanto não constituem garantia universal para todos os aparelhos/versões de sistema.

O serviço permanece restrito ao loopback do Mac (`127.0.0.1`). Esta validação não abre acesso de rede: um celular físico não acessa o serviço do Mac usando seu próprio `127.0.0.1`. O suporte de acesso remoto/LAN e a instalação de um servidor Git no dispositivo móvel não fazem parte desta alteração. Os fluxos Git aqui comprovados usam o serviço local no ambiente de teste.

## Persistência de imagens no WebKit

A revisão das capturas encontrou um alerta que os testes geométricos iniciais não detectavam. O diagnóstico isolou a causa: este WebKit retornava `UnknownError: Error preparing Blob/File data to be stored in object store` ao gravar Blob/File no IndexedDB; gravação de ArrayBuffer funcionava. Os rascunhos agora armazenam bytes e metadados, reconstruindo o File ao carregar. A escrita é serializada para evitar que uma conversão de imagem antiga sobrescreva texto mais recente; rascunhos anteriores com File continuam legíveis.

A matriz passou a exigir gravação efetiva de texto + bytes da imagem no IndexedDB, recuperação de tabela/texto/imagem após reload em cada orientação, persistência da edição offline e ausência de alertas. Há também uma jornada específica de compatibilidade com rascunho no formato anterior.
