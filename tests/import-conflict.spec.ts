import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Exercise browser file import and genuine external edits against a real Git checkout. */
for (const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
test(`${viewport.name}: local file import binds its original version; real conflicts preserve both texts`, async ({ page }) => {
  await page.setViewportSize(viewport);
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
    const gear = page.getByRole('button', { name: 'Configurações', exact: true });
    await expect(settings).toBeVisible();
    if (!(await page.locator('details.repository').evaluate(el => el.hasAttribute('open')))) await page.locator('details.repository > summary').click();
    await page.route('**/api/pick-folder', route => route.fulfill({ json: { directory: repo } }));
    await page.getByRole('button', { name: 'Selecionar pasta', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Repositório conectado.');
    await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({name:'existing.md',mimeType:'text/markdown',buffer:Buffer.from(original)});
    await page.getByRole('button', { name:'Fonte',exact:true }).click();
    const source = page.locator('.cm-content');
    await source.click(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.insertText('\nLocal import edit.');
    await page.getByRole('button', { name:'Salvar no repositório',exact:true }).click();
    await expect(page.getByRole('status')).toHaveText('Arquivo salvo, commit criado e enviado ao remoto.');
    expect(git('-C',remote,'show','main:existing.md')).toContain('Local import edit.');

    // Opening through repository settings must also keep the on-disk version.
    await gear.click(); await page.getByLabel('Arquivos do repositório',{exact:true}).selectOption('existing.md');
    await page.getByRole('button',{name:'Abrir do repositório'}).click(); await expect(page.getByRole('status')).toHaveText('Documento aberto.');
    await source.click(); await page.keyboard.insertText('Repository open edit.');
    await page.getByRole('button', { name:'Salvar no repositório',exact:true }).click();
    await expect(page.getByRole('status')).toHaveText('Arquivo salvo, commit criado e enviado ao remoto.');
    expect(git('-C',remote,'show','main:existing.md')).toContain('Repository open edit.');

    await source.click(); await page.keyboard.insertText('Unsaved browser draft.');
    await writeFile(join(repo,'existing.md'),'# External version\n');
    await page.getByRole('button', { name:'Salvar no repositório',exact:true }).click();
    const conflict = page.getByRole('dialog',{name:'Resolver versões do arquivo',exact:true});
    await expect(conflict).toBeVisible();
    expect(await conflict.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({path:`docs/evidence/${viewport.name}-resolve-file-conflict.png`,fullPage:true});
    expect(await readFile(join(repo,'existing.md'),'utf8')).toBe('# External version\n');
    await conflict.getByRole('button',{name:'Continuar editando',exact:true}).click();
    await expect(source).toContainText('Unsaved browser draft.');
    await page.getByRole('button', { name:'Salvar no repositório',exact:true }).click();
    await expect(conflict).toBeVisible();
    await conflict.getByLabel('Nome da cópia',{exact:true}).fill('recovered-copy.md');
    await conflict.getByRole('button',{name:'Salvar uma cópia',exact:true}).click();
    await expect(page.getByRole('status')).toHaveText('Arquivo salvo, commit criado e enviado ao remoto.');
    expect(await readFile(join(repo,'existing.md'),'utf8')).toBe('# External version\n');
    expect(git('-C',remote,'show','main:recovered-copy.md')).toContain('Unsaved browser draft.');
  } finally { await rm(temporary,{recursive:true,force:true}); }
});

}
