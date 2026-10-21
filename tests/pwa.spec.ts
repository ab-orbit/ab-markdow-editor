import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { unzipSync, strFromU8 } from 'fflate';

for (const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
  test(`${viewport.name}: installable PWA preserves text and images across offline reload and reconnect`, async ({page,context}) => {
    test.setTimeout(90000);
    const temporary=await mkdtemp(join(tmpdir(),'markdown-pwa-'));const repo=join(temporary,'repo'),remote=join(temporary,'remote.git');
    const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'});
    try {
      git('init','-b','main',repo);git('init','--bare','-b','main',remote);
      for(const [key,value] of [['user.name','PWA Test'],['user.email','pwa@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])git('-C',repo,'config',key,value);
      await writeFile(join(repo,'README.md'),'# PWA\n');git('-C',repo,'add','.');git('-C',repo,'commit','-m','Initial');git('-C',repo,'remote','add','origin',remote);git('-C',repo,'push','-u','origin','main');
      await page.setViewportSize(viewport);await page.goto('/');page.on('dialog',dialog=>dialog.accept());
      const settings=page.getByRole('region', {name:'Configurações',exact:true});const gear=page.getByRole('button',{name:'Configurações',exact:true});
      await expect(settings).toBeVisible();
      if(!(await page.locator('details.repository').evaluate(el=>el.hasAttribute('open'))))await page.locator('details.repository > summary').click();
      await page.route('**/api/pick-folder',route=>route.fulfill({json:{directory:repo}}));
      await page.getByRole('button',{name:'Selecionar pasta',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Repositório conectado.');
      await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
      await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
      const manifest=await (await page.request.get('/manifest.webmanifest')).json();
      expect(manifest.display).toBe('standalone');expect(manifest.id).toBe('/');expect(manifest.icons.filter((icon:{purpose:string})=>icon.purpose==='maskable')).toHaveLength(2);
      for(const icon of manifest.icons){const dimensions=await page.evaluate(async(src:string)=>{const image=await createImageBitmap(await(await fetch(src)).blob());return `${image.width}x${image.height}`;},icon.src);expect(dimensions).toBe(icon.sizes);}
      const cdp=await context.newCDPSession(page);const installability=await cdp.send('Page.getInstallabilityErrors');expect(installability.installabilityErrors.filter((error:{errorId:string})=>error.errorId!=='in-incognito')).toEqual([]);
      expect((await cdp.send('Page.getAppManifest')).url).toContain('/manifest.webmanifest');
      await gear.click();await page.getByLabel('Caminho do arquivo no repositório').fill('caderno-pwa.md');await settings.getByRole('button',{name:'Voltar ao editor',exact:true}).click();
      await page.getByRole('button',{name:'Fonte',exact:true}).click();const source=page.locator('.cm-content');await source.click();await page.keyboard.insertText('# Caderno PWA\n\nTexto com conexão.\n');
      const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVf0AAAAASUVORK5CYII=','base64');
      await page.getByLabel('Arquivos de imagem',{exact:true}).setInputFiles({name:'pixel.png',mimeType:'image/png',buffer:image});
      await page.getByRole('button',{name:'Salvar no repositório',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Arquivo salvo, commit criado e enviado ao remoto.');
      const onlineHead=git('-C',repo,'rev-parse','HEAD');
      await context.setOffline(true);await source.click();await page.keyboard.insertText('Rascunho offline preservado — ação e evidência.');
      await page.getByRole('button',{name:'Salvar no repositório',exact:true}).click();await expect(page.getByRole('status')).toContainText('Rascunho preservado no navegador.');
      await expect.poll(()=>page.evaluate(()=>new Promise<boolean>((resolve,reject)=>{const request=indexedDB.open('ab-markdown-drafts',1);request.onsuccess=()=>{const all=request.result.transaction('drafts').objectStore('drafts').getAll();all.onsuccess=()=>resolve(all.result.some(draft=>draft.value.includes('Rascunho offline preservado')));all.onerror=()=>reject(all.error);};request.onerror=()=>reject(request.error);}))).toBe(true);
      await page.reload();await page.getByRole('button',{name:'Fonte',exact:true}).click();await expect(source).toContainText('Rascunho offline preservado');
      await expect(settings).toHaveCount(0);
      await page.getByRole('button',{name:'Ler',exact:true}).click();await expect(page.locator('article img')).toHaveCount(1);await expect(page.locator('article img')).toBeVisible();
      const downloadEvent=page.waitForEvent('download');await page.getByLabel('Exportar nota', {exact:true}).click(); await page.getByRole('button', {name:/^Markdown \(.md\)/}).click();const download=await downloadEvent;
      const archive=unzipSync(new Uint8Array(await readFile((await download.path())!)));expect(strFromU8(archive['text.md'])).toContain('Rascunho offline preservado');expect(Object.keys(archive).filter(name=>name.startsWith('assets/'))).toHaveLength(1);
      await page.screenshot({path:`docs/evidence/${viewport.name}-pwa-offline-draft.png`,fullPage:true});
      const cached=await page.evaluate(async()=>{const keys=await caches.keys();const result={urls:[] as string[],shell:''};for(const key of keys){const cache=await caches.open(key);result.urls.push(...(await cache.keys()).map(request=>new URL(request.url).pathname));const shell=await cache.match('/app-shell.html');if(shell)result.shell=await shell.text();}return result;});
      expect(cached.urls.some(url=>url.startsWith('/api/')||url==='/health')).toBe(false);expect(cached.shell).not.toContain('window.__MARKDOWN_TOKEN__=');
      expect(git('-C',repo,'rev-parse','HEAD')).toBe(onlineHead);
      await context.setOffline(false);await page.getByRole('button',{name:'Salvar no repositório',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Arquivo salvo, commit criado e enviado ao remoto.');
      expect(git('-C',remote,'show','main:caderno-pwa.md')).toContain('Rascunho offline preservado');
      await gear.click();await page.getByRole('region',{name:'Aplicativo PWA'}).scrollIntoViewIfNeeded();await page.screenshot({path:`docs/evidence/${viewport.name}-pwa-install-settings.png`,fullPage:true});
    } finally {await context.setOffline(false);await rm(temporary,{recursive:true,force:true});}
  });
}
