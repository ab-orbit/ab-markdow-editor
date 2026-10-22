import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const catalogs=Object.fromEntries(['en','de','fr'].map(language=>[language,JSON.parse(readFileSync(`src/i18n/${language}.json`,'utf8'))]));
const keys=new Set();
for(const file of readdirSync('src',{recursive:true}).filter(file=>/\.tsx?$/.test(file)&&!file.startsWith('i18n/'))){
 const source=ts.createSourceFile(file,readFileSync('src/'+file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(source)==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))keys.add(node.arguments[0].text);ts.forEachChild(node,visit);};visit(source);
}
// Backend and native failures reach t(message) dynamically, outside literal frontend call scanning.
for(const file of ['server/repository.mjs','server/index.mjs','server/github/service.mjs']) {
 const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const visit=node=>{
  if((ts.isNewExpression(node)&&node.expression.getText(source)==='Error'||ts.isCallExpression(node)&&node.expression.getText(source)==='fail')&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0]))keys.add(node.arguments[0].text);
  if(ts.isPropertyAssignment(node)&&node.name.getText(source)==='error'&&ts.isStringLiteral(node.initializer))keys.add(node.initializer.text);
  ts.forEachChild(node,visit);
 };visit(source);
}
for(const [,message]of readFileSync('ios/App/App/ScribaNative.swift','utf8').matchAll(/(?:problem|reject)\("([^"\n]+)"/g))if(!message.includes('\\('))keys.add(message);
const placeholders=value=>[...value.matchAll(/\{\d+\}/g)].map(match=>match[0]).sort();
for(const [language,catalog]of Object.entries(catalogs)){
 for(const glyph of ['B','I','U'])assert.equal(catalog[glyph],glyph,`${language}: formatting glyphs stay literal`);
 assert.deepEqual(Object.keys(catalog).sort(),Object.keys(catalogs.en).sort(),`${language}: catalog key coverage differs`);
 for(const [key,value]of Object.entries(catalog))assert.deepEqual(placeholders(value),placeholders(key),`${language}: catalog placeholders in ${key}`);
 for(const key of keys){assert.ok(typeof catalog[key]==='string'&&catalog[key].length,`${language}: missing ${key}`);assert.deepEqual(placeholders(catalog[key]),placeholders(key),`${language}: placeholders in ${key}`);}
 console.log(`${language}: ${keys.size} application strings covered; placeholders valid.`);
}

// Duplicate plist keys are accepted by Apple tooling but silently discard earlier values.
const nativeInfo=readFileSync('ios/App/App/Info.plist','utf8');
assert.equal([...nativeInfo.matchAll(/<key>CFBundleLocalizations<\/key>/g)].length,1,'Declare native localizations exactly once');
const nativeLanguages=nativeInfo.match(/<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1];
assert.ok(nativeLanguages,'Native localizations must be declared');
assert.deepEqual([...nativeLanguages.matchAll(/<string>(.*?)<\/string>/g)].map(match=>match[1]).sort(),['pt-BR','en','de','fr'].sort(),'Native language list must match the interface');
console.log('Native locale declaration is unique and includes all four interface languages.');

for(const language of ['pt-BR','en','de','fr']) {
 const permissions=readFileSync(`ios/App/App/${language}.lproj/InfoPlist.strings`,'utf8');
 for(const key of ['NSCameraUsageDescription','NSPhotoLibraryUsageDescription'])assert.ok(permissions.includes(`"${key}" = "`),`${language}: missing native permission explanation ${key}`);
}
console.log('Camera and photo permission explanations exist in all four native languages.');
