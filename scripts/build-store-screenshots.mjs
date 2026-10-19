import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

/** Reproducible screenshots use a fresh browser and fictional notes, never the owner's browser profile. */
const root = new URL('../',import.meta.url), port=43139, url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,env:{...process.env,VITE_STORAGE_MODE:'browser'},stdio:'ignore'});
let browser;
const source=`# Um lugar para suas ideias

Escreva com calma. Organize suas notas, conecte ideias e transforme o que você sabe em algo que possa compartilhar.

## Do rascunho ao próximo passo

- [x] Reunir as referências
- [x] Desenhar o caminho
- [ ] Compartilhar a primeira versão

\`\`\`mermaid
flowchart LR
  A[Ideia] --> B[Pesquisa]
  B --> C[Escrita]
  C --> D[Próximo passo]
\`\`\`

## Cada coisa em seu lugar

| Espaço | O que guardar |
| --- | --- |
| Projetos | Planos, tarefas e decisões |
| Referências | Anotações e fontes |
| Diário | Ideias que merecem continuar |

Suas notas podem ficar no dispositivo, em uma pasta escolhida ou no seu GitHub.
`;
try {
  let ready=false;for(let attempt=0;attempt<100;attempt++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}if(!ready)throw new Error('Screenshot preview did not start.');
  browser=await chromium.launch({channel:'chrome',headless:true});
  await mkdir(new URL('public/screenshots/',root),{recursive:true});
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport,locale:'pt-BR',deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();
    await page.goto(url);const input=page.getByLabel('Arquivo Markdown',{exact:true});await input.waitFor({state:'attached'});
    await page.waitForFunction(()=>!document.querySelector('input[aria-label="Arquivo Markdown"]')?.disabled);
    await input.setInputFiles({name:'Ideias.md',mimeType:'text/markdown',buffer:Buffer.from(source)});
    await page.keyboard.press('Meta+s');
    await page.getByRole('heading',{name:'Um lugar para suas ideias',exact:true}).waitFor();
    await page.locator('figure[data-diagram-state="ready"]').waitFor({timeout:30000});
    const close=page.getByRole('button',{name:'Fechar lista de notas',exact:true});if(name==='mobile'&&await close.isVisible())await close.click();
    await page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll('.toast').forEach(element=>element.remove());});
    await page.screenshot({path:new URL(`public/screenshots/editor-${name}.png`,root).pathname});await context.close();
  }
  console.log('PWA screenshots: 1440×900 desktop and 390×844 mobile, fictional content only.');
} finally {await browser?.close();server.kill('SIGTERM');}
