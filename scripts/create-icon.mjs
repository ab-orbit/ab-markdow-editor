import { deflateSync } from 'node:zlib';
import { writeFileSync, readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
const color = name => css.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6});`, 'i'))[1].match(/../g).map(n => parseInt(n,16));
const bg = color('bg-surface'), lime = color('lime'), text = color('text-primary');
const size = 1024, pixels = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  let rgb = bg;
  const paper = x > 245 && x < 780 && y > 150 && y < 870;
  if (paper && (x < 270 || x > 755 || y < 175 || y > 845)) rgb = lime;
  if (paper && x > 335 && x < 690 && ((y > 320 && y < 350) || (y > 440 && y < 470) || (y > 560 && y < 590))) rgb = text;
  if (x > 540 && x < 685 && y > 690 && y < 735) rgb = lime;
  const i = y * (size * 4 + 1) + 1 + x * 4;
  pixels.set([...rgb, 255], i);
}
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc>>>1)^((crc&1)?0xedb88320:0); } return (crc^0xffffffff)>>>0; }
function chunk(name, data) { const type=Buffer.from(name); const length=Buffer.alloc(4);length.writeUInt32BE(data.length); const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([length,type,data,crc]); }
const header = Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
writeFileSync(process.argv[2], Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
