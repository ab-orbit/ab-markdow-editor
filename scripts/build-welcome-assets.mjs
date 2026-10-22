import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

/** Reproduce the welcome composition with localized editable text and an unaltered illustration. */
const root=new URL('../docs/app-store/welcome-assets/',import.meta.url);
const previous=new URL('../docs/app-store/creative-assets/',import.meta.url);
const sizes=[[5244,2950],[3840,2560],[1920,1280]];
const copy={
 'pt-BR':{title:'Bem-vindo ao Scriba',body:'Escreva, organize e guarde suas notas Markdown neste navegador.'},
 'en-US':{title:'Welcome to Scriba',body:'Write, organize and keep your Markdown notes in this browser.'},
 'de-DE':{title:'Willkommen bei Scriba',body:'Schreiben, organisieren und speichern Sie Ihre Markdown-Notizen in diesem Browser.'},
 'fr-FR':{title:'Bienvenue dans Scriba',body:'Rédigez, organisez et conservez vos notes Markdown dans ce navigateur.'}
};
await mkdir(new URL('sources/',root),{recursive:true});
await mkdir(new URL('fonts/',root),{recursive:true});
for(const name of ['BricolageGrotesque-Bold.ttf','BricolageGrotesque-OFL.txt','InstrumentSans-Regular.ttf','InstrumentSans-OFL.txt'])await copyFile(new URL('fonts/'+name,previous),new URL('fonts/'+name,root));
await copyFile(new URL('../docs/welcome-texts/assets/boas-vindas.jpg',import.meta.url),new URL('sources/boas-vindas.jpg',root));
await writeFile(new URL('sources/copy.json',root),JSON.stringify(copy,null,2)+'\n');
const data=async(path,mime)=>`data:${mime};base64,${(await readFile(path)).toString('base64')}`;
const illustration=await data(new URL('sources/boas-vindas.jpg',root),'image/jpeg');
const bold=await data(new URL('fonts/BricolageGrotesque-Bold.ttf',root),'font/ttf');
const regular=await data(new URL('fonts/InstrumentSans-Regular.ttf',root),'font/ttf');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const browser=await chromium.launch();const page=await browser.newPage();const assets=[];
try{
 for(const [locale,c]of Object.entries(copy)){
  await mkdir(new URL(`exports/${locale}/`,root),{recursive:true});await mkdir(new URL(`templates/${locale}/`,root),{recursive:true});
  for(const [w,h]of sizes){
   // A common centered layout preserves the complete 2:1 illustration across both aspect ratios.
   const vw=w/h*1280,iw=1540,x=(vw-iw)/2;
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${vw} 1280" role="img" aria-labelledby="title"><title id="title">${esc(c.title)}</title><defs><style>@font-face{font-family:Display;src:url('${bold}');font-weight:700}@font-face{font-family:Body;src:url('${regular}')}</style><clipPath id="rounded"><rect x="${x}" y="245" width="${iw}" height="770" rx="6"/></clipPath></defs><rect id="background" width="${vw}" height="1280" fill="#1f2020"/><text id="heading" x="${x}" y="135" font-family="Display" font-weight="700" font-size="76" fill="#c6d5da">${esc(c.title)}</text><image id="illustration" href="${illustration}" x="${x}" y="245" width="${iw}" height="770" preserveAspectRatio="xMidYMid meet" clip-path="url(#rounded)"/><text id="description" x="${x}" y="1105" font-family="Body" font-size="40" fill="#e0e0e0">${esc(c.body)}</text></svg>`;
   await page.setViewportSize({width:w,height:h});await page.setContent(`<style>body{margin:0;background:#1f2020}svg{display:block}</style>${svg}`);
   await page.evaluate(async()=>{await document.fonts.ready;const image=new Image();image.src=document.querySelector('image').getAttribute('href');await image.decode();});
   const bounds=await page.evaluate(({iw,x})=>{
    const heading=document.querySelector('#heading');if(heading.getComputedTextLength()>iw)heading.setAttribute('font-size',76*iw/heading.getComputedTextLength());
    const body=document.querySelector('#description'),words=body.textContent.split(' ');body.textContent='';let line='',n=0;
    for(const word of words){const candidate=line?line+' '+word:word;const test=document.createElementNS('http://www.w3.org/2000/svg','tspan');test.textContent=candidate;body.append(test);const width=test.getComputedTextLength();test.remove();if(width>iw&&line){const span=document.createElementNS('http://www.w3.org/2000/svg','tspan');span.setAttribute('x',x);span.setAttribute('dy',n?58:0);span.textContent=line;body.append(span);n++;line=word;}else line=candidate;}
    const span=document.createElementNS('http://www.w3.org/2000/svg','tspan');span.setAttribute('x',x);span.setAttribute('dy',n?58:0);span.textContent=line;body.append(span);
    return ['heading','description'].map(id=>{const b=document.getElementById(id).getBBox();return {id,x:b.x,y:b.y,width:b.width,height:b.height};});
   },{iw,x});
   if(bounds.some(b=>b.x<x-1||b.width>iw+2||b.y+b.height>1230))throw Error('Text overflow: '+locale);
   const name=`welcome-${w}x${h}`;
   await writeFile(new URL(`templates/${locale}/${name}.svg`,root),await page.locator('svg').evaluate(el=>new XMLSerializer().serializeToString(el)));
   const png=await page.screenshot({path:new URL(`exports/${locale}/${name}.png`,root).pathname});
   if(png[25]!==2||png.readUInt32BE(16)!==w||png.readUInt32BE(20)!==h)throw Error('Invalid PNG format');
   assets.push({locale,width:w,height:h,png:`exports/${locale}/${name}.png`,svg:`templates/${locale}/${name}.svg`,sha256:createHash('sha256').update(png).digest('hex'),bounds});
  }
  console.log(locale+': three PNGs and three editable SVGs validated');
 }
 await writeFile(new URL('manifest.json',root),JSON.stringify({assets},null,2)+'\n');
 const thumbs=await Promise.all(Object.keys(copy).map(async locale=>({locale,src:await data(new URL(`exports/${locale}/welcome-1920x1280.png`,root),'image/png')})));
 await page.setViewportSize({width:1600,height:1140});await page.setContent(`<style>body{margin:0;padding:28px;box-sizing:border-box;background:#141515;display:grid;grid-template-columns:1fr 1fr;gap:24px;color:#e0e0e0;font:20px system-ui}img{width:760px;display:block}p{margin:8px 0}</style>${thumbs.map(t=>`<div><img src="${t.src}"><p>${t.locale}</p></div>`).join('')}`);await page.evaluate(async()=>await Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:new URL('PREVIEW.png',root).pathname});
}finally{await browser.close();}
