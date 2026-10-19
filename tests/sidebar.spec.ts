import {test,expect} from '@playwright/test';
import {mkdtemp,writeFile,utimes,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
 test(`${viewport.name}: branded editor lists and opens latest 100 notes safely`,async({page})=>{
  const temporary=await mkdtemp(join(tmpdir(),'markdown-sidebar-'));const repo=join(temporary,'repo'),remote=join(temporary,'remote.git');
  const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'});
  try {
   git('init','-b','main',repo);git('init','--bare','-b','main',remote);
   for(const [key,value] of [['user.name','Sidebar Test'],['user.email','sidebar@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])git('-C',repo,'config',key,value);
   for(let i=0;i<105;i++){const filename=join(repo,`note-${String(i).padStart(3,'0')}.md`);await writeFile(filename,`# Nota ${i}\n\nConteúdo ${i}.`);const time=i>=102 ? new Date(Date.now()-(104-i)*86400000-2*3600000) : new Date(Date.UTC(2020,0,1,0,0,i));await utimes(filename,time,time);}
   git('-C',repo,'add','.');git('-C',repo,'commit','-m','Initial');git('-C',repo,'remote','add','origin',remote);git('-C',repo,'push','-u','origin','main');
   await page.setViewportSize(viewport);await page.goto('/');const settings=page.getByRole('region', {name:'Configurações',exact:true});await expect(settings).toBeVisible();
   if(!(await page.locator('details.repository').evaluate(el=>el.hasAttribute('open'))))await page.locator('details.repository > summary').click();
   await page.route('**/api/pick-folder',route=>route.fulfill({json:{directory:repo}}));await page.getByRole('button',{name:'Selecionar pasta',exact:true}).click();await expect(settings).toHaveCount(0);
   if(viewport.name==='mobile')await page.getByRole('button',{name:'Mostrar notas recentes'}).click();
   const brand=page.locator('.notes-logo');await expect(brand).toBeVisible();await expect(brand).toHaveAttribute('src','/icons/profile-v3/scribe-64.png');
   expect(await brand.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth===64)).toBe(true);
   const favicon=page.locator('link[rel="icon"][type="image/png"]');await expect(favicon).toHaveAttribute('href','/icons/profile-v3/scribe-32.png');expect((await page.request.get((await favicon.getAttribute('href'))!)).status()).toBe(200);
   const sidebar=page.getByRole('complementary',{name:'Notas recentes'});const recent=sidebar.locator('nav section:not([aria-label="Fixadas"])');const pinned=sidebar.getByRole('region',{name:'Fixadas',exact:true});await expect(pinned.locator('strong').first()).toHaveText('AB Markdown — Guia da plataforma');await expect(pinned.locator('img')).toBeVisible();expect(await pinned.locator('img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);await expect(recent.locator('li')).toHaveCount(100);await expect(recent.locator('strong').first()).toHaveText('Nota 104');await expect(recent.locator('strong').last()).toHaveText('Nota 5');
   await sidebar.getByRole('button',{name:'Fixar note-104.md',exact:true}).click();await expect(pinned.locator('strong')).toHaveText(['AB Markdown — Guia da plataforma','Scriba — Manual contextual de diagramas','Nota 104']);
   await sidebar.getByRole('button',{name:'Desafixar note-104.md',exact:true}).click();await expect(pinned.locator('strong')).toHaveCount(2);
   await expect(sidebar.getByRole('heading',{name:'Hoje',exact:true})).toBeVisible();await expect(sidebar.getByRole('heading',{name:'Ontem',exact:true})).toBeVisible();await expect(sidebar.getByRole('heading',{name:'Últimos 7 dias',exact:true})).toBeVisible();
   await expect(sidebar.locator('[data-note="note-104.md"] time')).toContainText(/há 2 h/);
   await expect(page.locator('.editor-brandbar')).toHaveCount(0);
   const search=page.getByRole('searchbox',{name:'Buscar nas notas recentes'});
   await search.fill('NOTA 104');await expect(recent.locator('li')).toHaveCount(1);
   await search.fill('Conteudo 103');await expect(recent.locator('li')).toHaveCount(1);await expect(recent.locator('strong').first()).toHaveText('Nota 103');
   await search.fill('note-102.md');await expect(recent.locator('li')).toHaveCount(1);
   await search.fill('inexistente');await expect(recent.locator('li')).toHaveCount(0);await expect(sidebar).toContainText('Nenhuma nota encontrada.');
   await search.fill('');await expect(recent.locator('li')).toHaveCount(100);
   await expect(recent.locator('.note-preview').first()).toContainText('Conteúdo 104');
   expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
   await page.screenshot({path:`docs/evidence/${viewport.name}-recent-notes-dark.png`,fullPage:true});
   await pinned.getByRole('button',{name:'AB-Markdown-Guia.md',exact:true}).click();await page.getByRole('button',{name:'Ler',exact:true}).click();await expect(page.locator('article')).toContainText('Roadmap previsto');await expect(page.locator('article img')).toBeVisible();expect(await page.locator('article img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
   expect(await page.locator('article').evaluate(el=>getComputedStyle(el).fontFamily)).not.toContain('mono');
   await page.screenshot({path:`docs/evidence/${viewport.name}-guide-reading-dark.png`,fullPage:true});
   if(viewport.name==='mobile')await page.getByRole('button',{name:'Mostrar notas recentes'}).click();
   await sidebar.getByRole('button',{name:'note-104.md',exact:true}).click();await page.getByRole('button',{name:'Fonte',exact:true}).click();await page.getByRole('button',{name:'Mostrar formatação'}).click();await expect(page.getByRole('button',{name:'Negrito',exact:true})).toBeVisible();await page.getByRole('button',{name:'Ocultar formatação'}).click();const source=page.locator('.cm-content');await expect(source).toContainText('Conteúdo 104');await source.click();await page.keyboard.insertText('Edição preservada');
   if(viewport.name==='mobile')await page.getByRole('button',{name:'Mostrar notas recentes'}).click();
   page.once('dialog',dialog=>dialog.dismiss());await sidebar.getByRole('button',{name:'note-103.md',exact:true}).click();await expect(source).toContainText('Edição preservada');
   page.once('dialog',dialog=>dialog.accept());await sidebar.getByRole('button',{name:'note-103.md',exact:true}).click();await page.getByRole('button',{name:'Fonte',exact:true}).click();await expect(source).toContainText('Conteúdo 103');await source.click();await page.keyboard.insertText('Atualizado');
   await page.getByRole('button',{name:'Salvar no repositório',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Arquivo salvo, commit criado e enviado ao remoto.');
   if(viewport.name==='mobile')await page.getByRole('button',{name:'Mostrar notas recentes'}).click();await expect(recent.locator('strong').first()).toHaveText('Nota 103');
   await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('button',{name:'Usar tema claro'}).click();await settings.getByRole('button',{name:'Voltar ao editor',exact:true}).click();
   await page.screenshot({path:`docs/evidence/${viewport.name}-recent-notes-light.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await rm(temporary,{recursive:true,force:true});}
 });
}
