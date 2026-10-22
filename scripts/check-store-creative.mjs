import {chromium,expect} from '@playwright/test';
import {readFile,access} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../docs/app-store/creative-assets/',import.meta.url).pathname;
const manifest=JSON.parse(await readFile(root+'manifest.json','utf8'));if(manifest.assets.length!==36)throw new Error('Expected 36 assets');
for(const a of manifest.assets){const png=await readFile(root+a.png);if(png[25]!==2||png.readUInt32BE(16)!==a.width||png.readUInt32BE(20)!==a.height||createHash('sha256').update(png).digest('hex')!==a.sha256)throw new Error(a.png);await access(root+a.editable);}
const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('file://'+root+'index.html');
for(const language of ['pt-BR','en-US','de-DE','fr-FR']){await page.locator('select').selectOption(language);await expect(page.locator('#downloads li')).toHaveCount(9);await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode()));});const paths=await page.locator('figure img').evaluateAll(imgs=>imgs.map(img=>img.getAttribute('src')));if(paths.some(path=>!path.includes('/'+language+'/')))throw new Error('Wrong locale');await page.screenshot({path:root+'gallery-'+language+'.png'});}
console.log('PASS: 36 exact-size opaque RGB PNGs, checksums, editable masters, 4 localized gallery views and 9 download entries per locale.');}finally{await browser.close();}
