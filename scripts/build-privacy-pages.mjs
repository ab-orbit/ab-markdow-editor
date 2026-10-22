import {readFile,writeFile,mkdir} from 'node:fs/promises';

/** Generate public, script-free localized policies from the existing policy and its translations. */
const project=new URL('../',import.meta.url),origin='https://scriba.aeonbridge.app';
const translations=JSON.parse(await readFile(new URL('docs/privacy/translations.json',project),'utf8'));
const pt=JSON.parse(await readFile(new URL('docs/privacy/pt-BR.json',project),'utf8'));
const policies={'pt-BR':pt,...translations};
const names={'pt-BR':'Português','en-US':'English','de-DE':'Deutsch','fr-FR':'Français'};
const css=`:root{color-scheme:light dark;font:17px/1.65 system-ui,sans-serif}body{max-width:720px;margin:48px auto;padding:0 24px 48px}h1,h2{line-height:1.2}h1{overflow-wrap:anywhere}a{color:LinkText;text-underline-offset:.18em}nav{margin-bottom:32px}nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 8px}nav a:first-child{padding-left:0}a:focus-visible{outline:3px solid Highlight;outline-offset:4px}li{margin:8px 0}.languages{display:flex;flex-wrap:wrap;gap:0 8px;margin-bottom:40px}.languages [aria-current]{font-weight:700}code{overflow-wrap:anywhere}@media(max-width:600px){body{margin-top:24px}}`;
for(const [locale,c]of Object.entries(policies)){
 if(c.sections.length!==5||c.sections.reduce((n,s)=>n+s[1].length,0)!==9)throw Error('Incomplete policy: '+locale);
 const url=`${origin}/privacy/${locale}.html`;
 const html=`<!doctype html>\n<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${c.title} · Scriba</title><link rel="canonical" href="${url}">${Object.keys(policies).map(l=>`<link rel="alternate" hreflang="${l}" href="${origin}/privacy/${l}.html">`).join('')}<link rel="alternate" hreflang="x-default" href="${origin}/privacy.html"><style>${css}</style></head><body><nav aria-label="Scriba"><a href="/">Scriba</a> · <a href="/support.html">${c.support}</a></nav><nav class="languages" aria-label="${c.language}">${Object.entries(names).map(([l,n])=>`<a href="/privacy/${l}.html" lang="${l}" hreflang="${l}"${locale===l?' aria-current="page"':''}>${n}</a>`).join('')}</nav><main><h1>${c.title}</h1><p>${c.date}</p>${c.sections.map(([title,paragraphs])=>`<section><h2>${title}</h2>${paragraphs.map(p=>`<p>${p}</p>`).join('')}</section>`).join('\n')}</main></body></html>\n`;
 await mkdir(new URL('public/privacy/',project),{recursive:true});await writeFile(new URL(`public/privacy/${locale}.html`,project),html);
 if(locale==='pt-BR')await writeFile(new URL('public/privacy.html',project),html);
}
console.log('Four complete localized privacy pages and the existing Portuguese URL generated.');
