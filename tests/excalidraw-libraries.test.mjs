import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('all seven requested Excalidraw libraries are bundled intact with provenance and the MIT license',async()=>{
 const root=new URL('../public/excalidraw-libraries/',import.meta.url),catalog=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
 assert.equal(catalog.length,7);let count=0;
 for(const item of catalog){const bytes=await readFile(new URL(item.file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);const data=JSON.parse(bytes);assert.equal(data.type,'excalidrawlib');assert.equal((data.libraryItems||data.library).length,item.items);assert.ok(item.url.startsWith('https://libraries.excalidraw.com/libraries/'));count+=item.items;}
 assert.equal(count,187);assert.match(await readFile(new URL('LICENSE',root),'utf8'),/MIT License/);
});
