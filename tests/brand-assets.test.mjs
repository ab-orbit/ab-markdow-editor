import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
const directory=new URL('../public/icons/profile-v4/',import.meta.url);
// Decode the actual exported PNG scanlines so validation catches opaque black corners, not just filenames.
function png(name){
 const bytes=readFileSync(new URL(name,directory));assert.equal(bytes.subarray(1,4).toString(),'PNG');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),type=bytes[25],channels=type===6?4:3;
 assert.equal(bytes[24],8);assert.ok([2,6].includes(type));assert.equal(bytes[28],0);
 const chunks=[];for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset);if(bytes.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+length));offset+=length+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(stride*height);
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];for(let x=0;x<stride;x++){const index=y*stride+x,a=x>=channels?pixels[index-channels]:0,b=y?pixels[index-stride]:0,c=y&&x>=channels?pixels[index-stride-channels]:0;const predict=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];assert.notEqual(predict,undefined);pixels[index]=(raw[y*(stride+1)+1+x]+predict)&255;}}
 return {width,height,type,pixel(x,y){const start=(y*width+x)*channels;return [...pixels.subarray(start,start+3),channels===4?pixels[start+3]:255];}};
}
test('rounded logo exports retain transparent corners, tight bounds and no opaque black frame',()=>{
 for(const size of [16,32,48,64,180,192,512,1024]){
  const image=png(`scribe-${size}.png`);assert.equal(image.width,size);assert.equal(image.height,size);assert.equal(image.type,6);
  for(const [x,y]of [[0,0],[size-1,0],[0,size-1],[size-1,size-1]])assert.equal(image.pixel(x,y)[3],0);
  assert.ok(image.pixel(Math.floor(size/2),1)[3]>200,'The tile reaches the canvas edge rather than sitting inside a margin');
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const [r,g,b,a]=image.pixel(x,y);if(a>64)assert.ok(r+g+b>24,'No visible black frame pixels');}
 }
});
test('Apple and maskable artwork is opaque; the adaptive mark stays in its safe circle',()=>{
 for(const name of ['scribe-store-1024.png','scribe-apple-touch-180.png','scribe-maskable-512.png']){const image=png(name);assert.equal(image.type,2);assert.ok(image.pixel(0,0)[2]>20,'Opaque corners use navy rather than black');}
 const image=png('scribe-maskable-512.png');let markPixels=0;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const [r,g,b]=image.pixel(x,y);if(r>160&&((g<180&&b<130)||(g>155&&b>135))){markPixels++;assert.ok(Math.hypot(x-255.5,y-255.5)<=512*.4+2,'Cream/orange mark remains inside the maskable safe zone');}}
 assert.ok(markPixels>10000);
});
test('favicon contains real PNG payloads at seven sizes and active references use the new revision',()=>{
 const bytes=readFileSync(new URL('favicon.ico',directory));assert.equal(bytes.readUInt16LE(2),1);assert.equal(bytes.readUInt16LE(4),7);
 for(let index=0;index<7;index++){const entry=6+index*16,size=bytes[entry]||256,offset=bytes.readUInt32LE(entry+12);assert.equal(bytes.subarray(offset+1,offset+4).toString(),'PNG');assert.equal(bytes.readUInt32BE(offset+16),size);}
 const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url)));
 assert.ok(manifest.icons.every(icon=>icon.src.startsWith('/icons/profile-v4/')));
 assert.match(readFileSync(new URL('../scripts/prepare-ios.mjs',import.meta.url),'utf8'),/profile-v4\/scribe-store-1024.png/);
 assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/profile-v4\/scribe-apple-touch-180.png/);
});
