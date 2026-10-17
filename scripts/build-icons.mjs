import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Run when the artwork changes. Generated cross-platform browser assets are committed.
const icons = fileURLToPath(new URL('../public/icons/', import.meta.url));
const source = path.join(icons, 'scribe-source.png');
const resize = (input, size, output) => execFileSync('/usr/bin/sips', ['-z', String(size), String(size), input, '--out', output], { stdio: 'ignore' });
for (const size of [16,32,48,64,180,192,512,1024]) resize(source, size, path.join(icons, `scribe-${size}.png`));
const temporary = mkdtempSync(path.join(tmpdir(), 'scribe-icons-'));
try {
  const padded = path.join(temporary, 'maskable.png');
  resize(source, 640, padded);
  execFileSync('/usr/bin/sips', ['-p','1024','1024','--padColor','102231',padded,'--out',padded], { stdio:'ignore' });
  for (const size of [192,512]) resize(padded,size,path.join(icons,`scribe-maskable-${size}.png`));
} finally { rmSync(temporary,{recursive:true,force:true}); }
copyFileSync(path.join(icons,'scribe-180.png'),fileURLToPath(new URL('../public/apple-touch-icon.png',import.meta.url)));
// ICO directory containing PNG payloads at the common favicon sizes.
const sizes=[16,32,48], images=sizes.map(size=>readFileSync(path.join(icons,`scribe-${size}.png`)));
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
images.forEach((bytes,i)=>{const entry=6+i*16;header[entry]=sizes[i];header[entry+1]=sizes[i];header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(bytes.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=bytes.length;});
writeFileSync(fileURLToPath(new URL('../public/favicon.ico',import.meta.url)),Buffer.concat([header,...images]));
