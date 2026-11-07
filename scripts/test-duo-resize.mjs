import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';

// Only the explicitly created QA simulator is eligible. This never targets a user's device.
const device=process.argv[2];
if (!device || !/^[A-F0-9-]{36}$/i.test(device)) throw new Error('Pass the isolated Scriba Duo simulator UDID.');
const devices=Object.values(JSON.parse(execFileSync('xcrun',['simctl','list','devices','--json'],{encoding:'utf8'})).devices).flat();
const target=devices.find(item=>item.udid===device);
if(!target?.name.startsWith('Scriba Duo') || target.deviceTypeIdentifier!=='com.apple.CoreSimulator.SimDeviceType.iPhone-Duo') throw new Error('Only a named, isolated Scriba Duo QA simulator is permitted.');
const evidence='docs/evidence/iphone-duo-20261027';mkdirSync(evidence,{recursive:true});
const result=`artifacts/ios/duo-resize-${Date.now()}.xcresult`;
let finished=false,exitCode,resizeSession,container,lastPhase=-1;
const test=spawn('xcodebuild',['-quiet','-project','ios/App/App.xcodeproj','-scheme','Scriba','-configuration','Debug','-destination',`platform=iOS Simulator,id=${device}`,'-parallel-testing-enabled','NO','-derivedDataPath','/tmp/scriba-duo-derived','-resultBundlePath',result,'-only-testing:ScribaTests/ScribaTests/testDuoNativeWorkspaceResizing','CODE_SIGNING_ALLOWED=NO','test'],{stdio:['ignore','inherit','inherit']});
test.on('exit',code=>{finished=true;exitCode=code;});
try {
 const deadline=Date.now()+240_000;
 while (!finished && Date.now()<deadline) {
  // Xcode may replace the data-container URL during installation. Resolve it afresh.
  try{container=execFileSync('xcrun',['simctl','get_app_container',device,'com.aeonbridge.scriba','data'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
  const request=container && join(container,'Documents/duo-resize-request.json');
  if(request && existsSync(request)){
   let phase;try{phase=JSON.parse(readFileSync(request,'utf8'));}catch{}
   if(phase && phase.phase!==lastPhase){
    const args=['devicectl','device','appResize',resizeSession?'set':'start','--device',device,'--preferred-size',`${phase.width}x${phase.height}`];
    if(!resizeSession){resizeSession=spawn('xcrun',args,{stdio:['ignore','inherit','inherit']});}
    else execFileSync('xcrun',args,{stdio:'inherit'});
    lastPhase=phase.phase;console.log(`Applied real scene resize phase ${lastPhase}.`);
   }
  }
  await pause(350);
 }
 if(!finished){test.kill('SIGINT');throw new Error('Duo resize test timed out.');}
 if(container)for(const name of ['duo-resize-results.json',...Array.from({length:4},(_,i)=>`duo-resize-${i}.png`)]){
  const file=join(container,'Documents',name);if(existsSync(file))copyFileSync(file,join(evidence,name));
 }
 if(exitCode!==0)throw new Error(`Native resize test failed with ${exitCode}. Result: ${result}`);
 if(lastPhase!==3)throw new Error('All four real scene sizes must be visited.');
 console.log(`Duo resize validation passed. ${result}`);
}finally{resizeSession?.kill('SIGINT');}
