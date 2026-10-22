import {webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await webkit.launch({headless:true});
try {
 const page=await browser.newPage({hasTouch:true,isMobile:true,viewport:{width:1180,height:820},locale:'en-US',serviceWorkers:'block'});
 await page.goto(server.resolvedUrls.local[0]);
 await expect(page.getByLabel('Markdown file',{exact:true})).toBeEnabled();
 await page.getByLabel('Markdown file',{exact:true}).setInputFiles({name:'Tablet.md',mimeType:'text/markdown',buffer:Buffer.from('# Tablet\n\nText for reading and editing.\n')});
 await expect(page.locator('#recent-notes')).toHaveCount(0);
 const open=page.getByRole('button',{name:'Show recent notes',exact:true});
 await open.click();await expect(page.locator('#recent-notes')).toBeVisible();
 await page.getByRole('button',{name:'Hide recent notes',exact:true}).click();await expect(page.locator('#recent-notes')).toHaveCount(0);
 await open.click();await expect(page.locator('#recent-notes')).toBeVisible();
 await page.locator('[data-document-scroll]').click({position:{x:350,y:150}});
 await expect(page.locator('#recent-notes')).toHaveCount(0);
 await open.click();await expect(page.locator('#recent-notes')).toBeVisible();
 await page.setViewportSize({width:820,height:1180});
 await expect(page.locator('#recent-notes')).toHaveCount(0);
 console.log('Touch tablet: note opens without library, explicit opening works, document interaction and rotation dismiss it.');
}finally{await browser.close();await server.close();}
