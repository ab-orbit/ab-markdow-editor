import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Exercise browser file import and genuine external edits against a real Git checkout. */
for (const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
test(`${viewport.name}: local file import binds its original version; real conflicts preserve both texts`, async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  const temporary = await mkdtemp(join(tmpdir(), 'markdown-import-'));
  const repo = join(temporary, 'repo'), remote = join(temporary, 'remote.git');
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });
  const original = '# Original\n\nRepository document.\n';
  try {
    git('init', '-b', 'main', repo); git('init', '--bare', '-b', 'main', remote);
    for (const [key, value] of [['user.name','Import Test'],['user.email','import@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']]) git('-C',repo,'config',key,value);
    await writeFile(join(repo,'existing.md'), original); git('-C',repo,'add','.');git('-C',repo,'commit','-m','Initial');git('-C',repo,'remote','add','origin',remote);git('-C',repo,'push','-u','origin','main');
    await page.goto('/'); page.on('dialog', dialog => dialog.accept());
    const settings = page.getByRole('region', {name:'Configurações',exact:true});
    await expect(settings).toBeVisible();
    if (!(await page.locator('details.repository').evaluate(el => el.hasAttribute('open')))) await page.locator('details.repository > summary').click();
    if (!await page.getByRole('button', { name: 'Selecionar pasta', exact: true }).isVisible()) await page.getByRole('button', { name: 'Conectar repositório', exact: true }).click();
    await page.route('**/api/pick-folder', route => route.fulfill({ json: { directory: repo } }));
    await page.getByRole('button', { name: 'Selecionar pasta', exact: true }).click();
    const carry=page.getByRole('checkbox', {name:'Levar notas, imagens e subpastas atuais',exact:true});
    if(await carry.isVisible()) await carry.uncheck();
    await page.getByRole('button', { name: 'Revisar troca', exact: true }).click();
    await page.getByRole('button', { name: 'Conectar repositório', exact: true }).click();
    await expect(page.getByText('Pasta conectada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
    await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({name:'existing.md',mimeType:'text/markdown',buffer:Buffer.from(original)});
    await page.getByRole('button', { name:'Fonte',exact:true }).click();
    const source = page.locator('.cm-content');
    expect(await page.getByRole('button',{name:'Salvar no repositório',exact:true}).evaluate(element=>element.nextElementSibling?.getAttribute('aria-label'))).toBe('Salvar como');
    await source.click(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.insertText('\nLocal import edit.');
    await page.getByRole('button', { name:'Salvar no repositório',exact:true }).click();
    await expect(page.locator('p[role="status"]')).toHaveText('Arquivo salvo, commit criado e enviado ao remoto.');
    expect(git('-C',remote,'show','main:existing.md')).toContain('Local import edit.');

    await source.click(); await page.keyboard.insertText('Unsaved browser draft.');
    await writeFile(join(repo,'existing.md'),'# External version\n');
    await page.getByRole('button', { name:'Salvar no repositório',exact:true }).click();
    const conflict = page.getByRole('dialog',{name:'Resolver versões do arquivo',exact:true});
    await expect(conflict).toBeVisible();
    await page.setViewportSize(viewport);
    expect(await conflict.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const inputBounds = await conflict.getByLabel('Nome da cópia', {exact:true}).boundingBox();
    const buttons = await conflict.locator('footer button').evaluateAll(elements => elements.map(element => { const rect=element.getBoundingClientRect(); return {top:rect.top,bottom:rect.bottom}; }));
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button.top).toBeGreaterThanOrEqual(inputBounds!.y+inputBounds!.height);
    if(viewport.name==='desktop') {
      expect(Math.max(...buttons.map(button=>button.top))-Math.min(...buttons.map(button=>button.top))).toBeLessThan(2);
      expect((await conflict.boundingBox())!.width).toBeLessThanOrEqual(720);
    }
    await page.screenshot({path:`docs/evidence/${viewport.name}-resolve-file-conflict.png`,fullPage:true});
    await page.setViewportSize({width:1440,height:900});
    expect(await readFile(join(repo,'existing.md'),'utf8')).toBe('# External version\n');
    await conflict.getByRole('button',{name:'Continuar editando',exact:true}).click();
    await expect(source).toContainText('Unsaved browser draft.');
    await page.getByRole('button', { name:'Salvar no repositório',exact:true }).click();
    await expect(conflict).toBeVisible();
    await conflict.getByLabel('Nome da cópia',{exact:true}).fill('recovered-copy.md');
    await conflict.getByRole('button',{name:'Salvar uma cópia',exact:true}).click();
    await expect(page.locator('p[role="status"]')).toHaveText('Arquivo salvo, commit criado e enviado ao remoto.');
    expect(await readFile(join(repo,'existing.md'),'utf8')).toBe('# External version\n');
    expect(git('-C',remote,'show','main:recovered-copy.md')).toContain('Unsaved browser draft.');
  } finally { const {token}=await (await page.request.get('/api/session', {headers:{'x-ab-markdown-client':'1'}})).json(); await page.request.post('/api/disconnect', {headers:{authorization:`Bearer ${token}`},data:{repository:await realpath(repo)}}); await rm(temporary,{recursive:true,force:true}); }
});

}
