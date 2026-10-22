import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

/** Self-contained editable SVG masters and opaque, exact-size App Store creative exports. */
const root=new URL('../docs/app-store/creative-assets/',import.meta.url);
const copy=JSON.parse(await readFile(new URL('sources/copy.json',root),'utf8'));
const sizes=[[5244,2950],[3840,2560],[1920,1280]];
const concepts=[{id:'01-scriba',key:'brand',capture:'writing-dark',dark:true},{id:'02-escrita',key:'write',capture:'writing-light',dark:false},{id:'03-desenho',key:'draw',capture:'drawing-light',dark:true}];
const data=async(path,mime)=>`data:${mime};base64,${(await readFile(path)).toString('base64')}`;
const bold=await data(new URL('fonts/BricolageGrotesque-Bold.ttf',root),'font/ttf'),regular=await data(new URL('fonts/InstrumentSans-Regular.ttf',root),'font/ttf');
const logo=await data(new URL('../public/icons/profile-v4/scribe-256.png',import.meta.url),'image/png');
const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const browser=await chromium.launch({headless:true});const page=await browser.newPage({deviceScaleFactor:1});const manifest=[];
const fontCSS=`@font-face{font-family:ScribaDisplay;src:url('${bold}');font-weight:700}@font-face{font-family:ScribaBody;src:url('${regular}')}`;
function svg({w,h,c,concept,shot}){
 const vw=w/h*1280,offset=(vw-1920)/2,ink=concept.dark?'#f5edde':'#143449',muted=concept.dark?'#c2d4db':'#3f5964',bg=concept.dark?'#103044':'#f5edde';
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${w}" height="${h}" viewBox="0 0 ${vw} 1280" role="img" aria-labelledby="title desc">
 <title id="title">Scriba — ${escape(c[concept.key].join(' '))}</title><desc id="desc">Localized creative with an unaltered capture of the current Scriba interface and fictional demonstration content.</desc>
 <defs><style>${fontCSS}</style><filter id="shadow" x="-25%" y="-25%" width="160%" height="170%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#071b29" flood-opacity=".22"/></filter><clipPath id="screen"><rect x="950" y="220" width="840" height="840" rx="30"/></clipPath></defs>
 <g id="background" inkscape:label="01 · Background"><rect width="${vw}" height="1280" fill="${bg}"/><path d="M${vw-240} 0H${vw}V440Z" fill="${concept.dark?'#173e52':'#e9ddc8'}"/><circle cx="${offset+130}" cy="1340" r="290" fill="${concept.dark?'#163b4e':'#ebe0ce'}"/></g>
 <g transform="translate(${offset} 0)">
 <g id="brand" inkscape:label="02 · Brand"><image href="${logo}" x="145" y="210" width="100" height="100"/><text x="270" y="279" font-family="ScribaDisplay" font-weight="700" font-size="57" fill="${ink}">Scriba</text></g>
 <g id="headline" inkscape:label="03 · Editable headline" data-fit="headline" data-max-width="715" fill="${ink}" font-family="ScribaDisplay" font-weight="700" font-size="128"><text x="145" y="510">${escape(c[concept.key][0])}</text><text x="145" y="650">${escape(c[concept.key][1])}</text></g>
 <rect x="150" y="715" width="115" height="10" rx="5" fill="#ff841d"/>
 <g id="supporting-copy" inkscape:label="04 · Editable supporting copy" data-fit="body" data-max-width="720" fill="${muted}" font-family="ScribaBody" font-size="40"><text x="150" y="825">${escape(c[concept.key+'Sub'][0])}</text><text x="150" y="881">${escape(c[concept.key+'Sub'][1])}</text></g>
 <g id="feature-labels" inkscape:label="05 · Features" fill="${muted}" font-family="ScribaBody" font-size="30"><path d="${concept.key==='draw'?'M151 1032l3-10 19-19 7 7-19 19z M168 1008l7 7':'M151 1002h24v31h-24z m6 8h12 m-12 8h12 m-12 8h8'}" fill="none" stroke="${muted}" stroke-width="2" stroke-linejoin="round"/><text x="193" y="1026">${escape(c.features[concept.key==='draw'?2:0])}</text><circle cx="${concept.key==='draw'?345:385}" cy="1017" r="3" fill="#ff841d"/><text x="${concept.key==='draw'?367:407}" y="1026">Markdown</text></g>
 <g id="interface" inkscape:label="06 · Actual UI capture"><rect x="968" y="234" width="840" height="840" rx="32" fill="${concept.dark?'#385564':'#cfbda0'}" transform="rotate(3 1388 654)"/><rect x="944" y="214" width="852" height="852" rx="35" fill="${concept.dark?'#294a5b':'#18394c'}" filter="url(#shadow)"/><image id="capture" href="${shot}" x="950" y="220" width="840" height="840" preserveAspectRatio="xMidYMid meet" clip-path="url(#screen)"/></g>
 <g id="accent" inkscape:label="07 · Pen accent"><path d="M1738 1094l116-127 29 27-116 127-48 20z" fill="#ff841d"/><path d="M1719 1141l11-30 18 17z" fill="${ink}"/></g>
 <g id="guides" inkscape:label="08 · Crop guides (hidden in export)" display="none"><rect x="100" y="200" width="1720" height="900" fill="none" stroke="#ff00aa" stroke-width="3" stroke-dasharray="14 10"/><text x="100" y="180" font-family="ScribaBody" font-size="24" fill="#ff00aa">Conservative common crop area — verify in App Store Connect Preview</text></g>
 </g></svg>`;
}
try{
 for(const [locale,c]of Object.entries(copy)){
  await mkdir(new URL(`exports/${locale}/`,root),{recursive:true});await mkdir(new URL(`templates/${locale}/`,root),{recursive:true});
  for(const concept of concepts){
   const shot=await data(new URL(`captures/${locale}/${concept.capture}.png`,root),'image/png');
   for(const [w,h]of sizes){
    const name=`${concept.id}-${w}x${h}`,source=svg({w,h,c,concept,shot});
    await page.setViewportSize({width:w,height:h});await page.setContent(`<html><head><style>html,body{margin:0;width:100%;height:100%;background:#103044}svg{display:block;width:100%;height:100%}</style></head><body>${source}</body></html>`);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('image')].map(async image=>{const img=new Image();img.src=image.getAttribute('href');await img.decode();}));});
    const geometry=await page.evaluate(()=>{
     for(const group of document.querySelectorAll('[data-fit]')){
      const max=Number(group.getAttribute('data-max-width')),texts=[...group.querySelectorAll('text')];const width=Math.max(...texts.map(text=>text.getComputedTextLength()));
      if(width>max)group.setAttribute('font-size',String(Number(group.getAttribute('font-size'))*max/width));
     }
     return [...document.querySelectorAll('[data-fit]')].map(group=>({role:group.getAttribute('data-fit'),width:group.getBBox().width,max:Number(group.getAttribute('data-max-width'))}));
    });
    if(geometry.some(box=>box.width>box.max+1))throw new Error(`${locale}/${name}: overflowing text`);
    const final=await page.locator('svg').first().evaluate(element=>new XMLSerializer().serializeToString(element));
    await writeFile(new URL(`templates/${locale}/${name}.svg`,root),final);
    const png=await page.screenshot({path:new URL(`exports/${locale}/${name}.png`,root).pathname});
    if(png[25]!==2||png.readUInt32BE(16)!==w||png.readUInt32BE(20)!==h)throw new Error(`${name}: PNG must be opaque RGB at requested dimensions`);
    manifest.push({locale,concept:concept.id,width:w,height:h,png:`exports/${locale}/${name}.png`,editable:`templates/${locale}/${name}.svg`,sourceCapture:`captures/${locale}/${concept.capture}.png`,sha256:createHash('sha256').update(png).digest('hex'),colorType:'RGB',geometry});
   }
  }
  console.log(`${locale}: 9 opaque PNGs and 9 editable SVGs validated.`);
 }
 await writeFile(new URL('manifest.json',root),JSON.stringify({generatedAt:new Date().toISOString(),source:'Current Scriba responsive web UI, isolated browser, fictional notes; not a native-device screenshot certification',formats:sizes,assets:manifest},null,2)+'\n');
 const previews=concepts.map(concept=>`<figure><img src="exports/pt-BR/${concept.id}-1920x1280.png"><figcaption>${concept.id}</figcaption></figure>`).join('');
 await writeFile(new URL('index.html',root),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Scriba — peças para App Store</title><style>body{margin:0;padding:48px;background:#f5edde;color:#143449;font:18px/1.6 system-ui}h1{font-size:42px;line-height:1.1}main{max-width:1400px;margin:auto}figure{margin:32px 0}img{display:block;width:100%;border-radius:16px}a{color:#145568}select{font:inherit;padding:8px}ul{display:flex;flex-wrap:wrap;gap:24px;padding:0;list-style:none}figcaption{margin-top:8px}small{display:block}section{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}@media(max-width:800px){section{grid-template-columns:1fr}}</style><main><h1>Scriba · Suas ideias em Markdown</h1><p>Três conceitos. Quatro idiomas. PNGs opacos e SVGs editáveis.</p><label>Idioma <select id="language">${Object.keys(copy).map(key=>`<option>${key}</option>`).join('')}</select></label><section>${previews}</section><h2>Arquivos por formato</h2><ul id="downloads"></ul><p>Abra o SVG em um editor vetorial. A camada de guias está oculta por padrão. As capturas mostram a interface web atual com conteúdo demonstrativo.</p><a href="README.md">Orientações e especificações</a><script>const assets=${JSON.stringify(manifest)};function render(){const language=document.querySelector('select').value;document.querySelectorAll('figure').forEach((figure,i)=>figure.querySelector('img').src='exports/'+language+'/'+['01-scriba','02-escrita','03-desenho'][i]+'-1920x1280.png');document.querySelector('#downloads').innerHTML=assets.filter(asset=>asset.locale===language).map(asset=>'<li><strong>'+asset.concept+' · '+asset.width+' × '+asset.height+'</strong><small><a href="'+asset.png+'" download>PNG</a> · <a href="'+asset.editable+'" download>SVG editável</a></small></li>').join('');}document.querySelector('select').addEventListener('change',render);render();</script></main></html>`);
 // One overview image makes all three concepts reviewable without opening large masters.
 await page.setViewportSize({width:1600,height:450});const thumbs=await Promise.all(concepts.map(async concept=>await data(new URL(`exports/pt-BR/${concept.id}-1920x1280.png`,root),'image/png')));
 await page.setContent(`<style>body{margin:0;background:#f5edde;display:flex;gap:20px;padding:30px;box-sizing:border-box}img{width:500px;height:333.333px;border-radius:12px}div{font:18px system-ui;color:#143449}p{margin:12px 0}</style>${thumbs.map((src,i)=>`<div><img src="${src}"><p>${concepts[i].id}</p></div>`).join('')}`);await page.evaluate(async()=>{await Promise.all([...document.images].map(image=>image.decode()));});await page.screenshot({path:new URL('PREVIEW.png',root).pathname});
 console.log(`${manifest.length} assets exported; RGB dimensions, text bounds and checksums validated.`);
}finally{await browser.close();}
