import {test,expect} from '@playwright/test';
import {mkdtemp,writeFile,readFile,rm,mkdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('new notes focus H1 and use its title with an incremental filename on collisions', async ({page})=>{
  const temporary=await mkdtemp(join(tmpdir(),'scriba-note-title-')), repo=join(temporary,'repo'), remote=join(temporary,'remote.git');
  const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'});
  try{
    git('init','-b','main',repo);git('init','--bare','-b','main',remote);
    for(const [key,value] of [['user.name','Title Test'],['user.email','title@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])git('-C',repo,'config',key,value);
    await writeFile(join(repo,'Meu título.md'),'# Existing\n');await writeFile(join(repo,'Meu título (1).md'),'# Existing copy\n');
    git('-C',repo,'add','.');git('-C',repo,'commit','-m','Initial');git('-C',repo,'remote','add','origin',remote);git('-C',repo,'push','-u','origin','main');
    await page.setViewportSize({width:1440,height:900});await page.goto('/');
    await page.route('**/api/pick-folder',route=>route.fulfill({json:{directory:repo}}));
    await page.getByRole('button',{name:'Selecionar pasta',exact:true}).click();
    await page.getByRole('button',{name:'Revisar troca',exact:true}).click();
    await page.getByRole('button',{name:'Conectar repositório',exact:true}).click();
    await page.getByRole('button',{name:'Voltar ao editor',exact:true}).click();
    await page.getByRole('complementary',{name:'Notas recentes'}).getByRole('button',{name:'Nova nota',exact:true}).click();
    const confirmation=page.getByRole('dialog',{name:'Salvar antes de criar uma nova nota?',exact:true});
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button',{name:'Descartar e criar',exact:true}).click();
    const visual=page.locator('.tiptap');
    await expect(visual.locator('h1')).toBeVisible();await expect(visual).toBeFocused();
    expect(await visual.evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('none');
    await page.keyboard.insertText('Meu título');
    await expect(page.locator('span[title="Meu título (2).md"]')).toBeVisible();
    await expect(visual.locator('h1')).toHaveText('Meu título');
    await page.keyboard.press('Enter');await page.keyboard.insertText('Conteúdo da nota.');
    await expect(visual.locator('p')).toContainText('Conteúdo da nota.');
    await page.getByRole('button',{name:'Salvar no repositório',exact:true}).click();
    await expect(page.getByText('Arquivo salvo, commit criado e enviado ao remoto.',{exact:true})).toBeVisible();
    expect(await readFile(join(repo,'Meu título (2).md'),'utf8')).toContain('# Meu título');
    expect(await readFile(join(repo,'Meu título.md'),'utf8')).toBe('# Existing\n');
    // Once saved, changing the heading edits the note without silently renaming its file.
    await visual.locator('h1').click();await page.keyboard.press('Home');await page.keyboard.insertText('Novo ');
    await expect(page.locator('span[title="Meu título (2).md"]')).toBeVisible();
    await mkdir('docs/evidence/new-note-title',{recursive:true});
    await page.screenshot({path:'docs/evidence/new-note-title/title-filename-desktop.png'});
  }finally{const {token}=await(await page.request.get('/api/session',{headers:{'x-ab-markdown-client':'1'}})).json();await page.request.post('/api/disconnect',{headers:{authorization:`Bearer ${token}`},data:{repository:await realpath(repo)}});await rm(temporary,{recursive:true,force:true});}
});
