import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await(process.env.MARKDOWN_BROWSER==='webkit'?webkit:chromium).launch();
const evidence='docs/evidence/apple-design';await mkdir(evidence,{recursive:true});
try {for(const [width,height,theme] of [[1440,900,'light'],[1440,900,'dark'],[1024,768,'dark']]) {
 const context=await browser.newContext({locale:'pt-BR',viewport:{width,height},serviceWorkers:'block'});await context.addInitScript(theme=>localStorage.setItem('ab-markdown-theme',theme),theme);
 const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);await expect(page.locator('article h1').first()).toHaveText('Bem-vindo ao Scriba');
 const modes=page.getByRole('group',{name:'Modo de edição',exact:true});await expect(modes.getByRole('button')).toHaveCount(5);
 // A single reusable command surface serves the sidebar and export menus.
 await page.locator('.notes-menu > summary').click();const notes=page.locator('.notes-menu-content');await expect(notes).toHaveAttribute('data-ui','action-menu');await notes.press('ArrowDown');await expect(notes.getByRole('button').first()).toBeFocused();await page.keyboard.press('Escape');
 await page.getByLabel('Exportar nota',{exact:true}).click();const formats=page.getByRole('group',{name:'Formatos de exportação',exact:true});await expect(formats).toBeVisible();await formats.press('ArrowDown');await expect(formats.getByRole('button').first()).toBeFocused();await page.keyboard.press('Escape');await expect(formats).not.toBeVisible();
 await modes.getByRole('button',{name:'Escrever',exact:true}).click();const tools=page.getByRole('toolbar',{name:'Ferramentas de edição',exact:true});
 await tools.getByRole('button',{name:'Estilo do parágrafo',exact:true}).click();const headings=page.getByRole('menu',{name:'Estilo do parágrafo',exact:true});await expect(headings).toHaveAttribute('data-ui','action-menu');await page.keyboard.press('End');await expect(headings.getByRole('menuitem').last()).toBeFocused();await page.keyboard.press('Escape');await expect(headings).toHaveCount(0);
 await tools.getByRole('button',{name:'Inserir link',exact:true}).click();const link=page.getByRole('dialog',{name:'Inserir link',exact:true});await expect(link).toHaveAttribute('data-ui','dialog');await expect(link.getByLabel('Endereço',{exact:true})).toBeVisible();await link.screenshot({path:`${evidence}/${theme}-${width}-link-dialog.png`});await page.keyboard.press('Escape');await expect(link).toHaveCount(0);
 await tools.getByRole('button',{name:'Galeria de ícones',exact:true}).click();const icons=page.getByRole('dialog',{name:'Galeria de ícones',exact:true});await icons.getByRole('searchbox').fill('pencil');await expect(icons.getByRole('button',{name:'Inserir ícone pencil',exact:true})).toBeVisible();await icons.getByRole('button',{name:'Fechar',exact:true}).click();await expect(icons).toHaveCount(0);
 await modes.getByRole('button',{name:'Ler',exact:true}).click();await page.getByRole('button',{name:'Mostrar outline',exact:true}).click();await expect(page.getByRole('navigation',{name:'Seções da nota',exact:true})).toBeVisible();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${evidence}/${theme}-${width}-reading-outline.png`});
 await page.locator('.notes-menu > summary').click();await page.getByRole('button',{name:'Sobre o Scriba',exact:true}).click();
 const about=page.getByRole('dialog',{name:'Sobre o Scriba',exact:true});await expect(about.locator('.about-subtitle')).toHaveText('Suas ideias em Markdown');
 await expect(about.locator('.github-source')).toHaveText('');await expect(about.locator('.powered-by')).toHaveText('Powered by Aeon Bridge Co.');
 await expect.poll(()=>about.locator('.powered-by img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await about.screenshot({path:`${evidence}/${theme}-${width}-about.png`});await about.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('button',{name:'Configurações',exact:true}).click();await expect(page.getByRole('heading',{name:'Configurações',exact:true})).toBeVisible();await page.getByRole('button',{name:'Conectar GitHub',exact:true}).click();await expect(page.getByRole('heading',{name:'GitHub · todos os dispositivos',exact:true})).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
}console.log('PASS: desktop/tablet navigation, sidebar/export/portal command menus, keyboard, link and icon dialogs, outline, settings and GitHub entry in both themes.');}finally{await browser.close();await server.close();}
