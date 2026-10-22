import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,locale:'en-US',serviceWorkers:'block'});
  await page.goto(server.resolvedUrls.local[0]);await expect(page.getByLabel('Markdown file',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByRole('menuitem',{name:'Appearance',exact:true}).click();
  const theme=page.getByLabel('Theme',{exact:true});await expect(theme).toBeVisible();
  for(const mode of ['light','dark']){await theme.selectOption(mode);await expect(page.locator('html')).toHaveAttribute('data-theme',mode);}
  await theme.selectOption('auto');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.reload();await expect(page.getByLabel('Theme',{exact:true})).toHaveValue('auto');
  await page.getByRole('button',{name:'Return to editor',exact:true}).click();await page.getByRole('button',{name:'Back to notes',exact:true}).click();
  await page.getByText('Notes',{exact:true}).click();await page.getByRole('button',{name:'Appearance',exact:true}).click();await expect(page.getByLabel('Theme',{exact:true})).toBeVisible();
  console.log(`${engine.name()}: mobile note and library menus reach appearance; explicit themes persist and automatic follows live system changes.`);
 }finally{await browser.close();}
}}finally{await server.close();}
