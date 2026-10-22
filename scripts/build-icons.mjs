import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,copyFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
// One cleaned rounded master produces all platform assets; versioned URLs bypass old icon caches.
const root=fileURLToPath(new URL('../',import.meta.url)),icons=path.join(root,'public/icons');
const versioned=path.join(icons,'profile-v4');mkdirSync(versioned,{recursive:true});
execFileSync('/usr/bin/swift',[path.join(root,'scripts/render-brand-icons.swift'),path.join(icons,'scribe-source.png'),versioned],{stdio:'inherit'});
const sizes=[16,24,32,48,64,128,256],images=sizes.map(size=>readFileSync(path.join(versioned,`scribe-${size}.png`)));
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
images.forEach((bytes,index)=>{const entry=6+index*16;header[entry]=sizes[index]===256?0:sizes[index];header[entry+1]=header[entry];header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(bytes.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=bytes.length;});
const ico=Buffer.concat([header,...images]);writeFileSync(path.join(versioned,'favicon.ico'),ico);writeFileSync(path.join(root,'public/favicon.ico'),ico);
for(const size of [16,32,48,64,180,192,512,1024])copyFileSync(path.join(versioned,`scribe-${size}.png`),path.join(icons,`scribe-${size}.png`));
for(const size of [192,512])copyFileSync(path.join(versioned,`scribe-maskable-${size}.png`),path.join(icons,`scribe-maskable-${size}.png`));
copyFileSync(path.join(versioned,'scribe-apple-touch-180.png'),path.join(root,'public/apple-touch-icon.png'));
const temporary=mkdtempSync(path.join(tmpdir(),'scriba-brand-'));
try{
 const iconset=path.join(temporary,'Scriba.iconset');mkdirSync(iconset);
 for(const size of [16,32,128,256,512])for(const scale of [1,2])copyFileSync(path.join(versioned,`scribe-${size*scale}.png`),path.join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`));
 execFileSync('/usr/bin/iconutil',['-c','icns',iconset,'-o',path.join(versioned,'Scriba.icns')]);
}finally{rmSync(temporary,{recursive:true,force:true});}
console.log('Generated profile-v4: rounded PNG, Apple/store opaque PNG, maskable PNG, seven-size ICO and macOS ICNS.');
