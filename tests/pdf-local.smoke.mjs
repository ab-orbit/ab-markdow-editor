import {promises as fs} from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';import path from 'node:path';import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';
const exec=promisify(execFile),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-pdf-native-'));
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
let server;
try {
 const root=path.join(temporary,'notes'),state=path.join(temporary,'state');await fs.mkdir(root);await fs.mkdir(state);await exec('git',['init','-b','main',root]);const canonical=await fs.realpath(root);
 await fs.writeFile(path.join(root,'Test.md'),'# Test');await fs.writeFile(path.join(state,'settings.json'),JSON.stringify({repository:canonical,preferences:{askCommitNote:false,autoSave:false,intervalMinutes:1}}));
 await fs.writeFile(path.join(state,'library.json'),JSON.stringify({[canonical]:{pinned:['Test.md'],welcomeImageVersion:1,diagramManualVersion:1}}));
 const runtime=path.join(temporary,'runtime.json');server=spawn(process.execPath,['server/index.mjs'],{cwd,env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:state,MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
 let origin;for(let n=0;n<100;n++){try{origin=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
 if(!origin)throw Error('No local server.');
 const policy=(await fetch(origin)).headers.get('content-security-policy');
 assert.ok(policy.includes("default-src 'self'"));assert.ok(!policy.includes('unsafe-eval')&&!policy.includes('worker-src blob:'));
 console.log('Checking PDF with the unchanged native server policy and isolated test files.');
 const child=spawn(process.execPath,['tests/pdf.smoke.mjs'],{cwd,env:{...process.env,SCRIBA_URL:origin},stdio:'inherit'});const code=await new Promise(resolve=>child.once('exit',resolve));if(code!==0)throw Error('Local PDF check failed.');
}finally{server?.kill();if(server)await new Promise(resolve=>server.once('exit',resolve));await fs.rm(temporary,{recursive:true,force:true});}
