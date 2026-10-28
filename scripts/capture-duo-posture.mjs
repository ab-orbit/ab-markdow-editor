import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';

// This records real Device Hub actions during testDuoRealPostureSession.
// It does not set a posture, inject a reserved region, or touch a physical device.
const [device,label,posture,anchorPrefix]=process.argv.slice(2);
if (!device || !/^[A-F0-9-]{36}$/i.test(device) || !/^[a-z0-9-]+$/.test(label || '')) throw new Error('Pass an isolated QA simulator UDID and an ASCII capture label (or finish).');
const devices=Object.values(JSON.parse(execFileSync('xcrun',['simctl','list','devices','--json'],{encoding:'utf8'})).devices).flat();
const target=devices.find(item=>item.udid===device);
if(!target?.name.startsWith('Scriba Duo') || target.deviceTypeIdentifier!=='com.apple.CoreSimulator.SimDeviceType.iPhone-Duo') throw new Error('Only a named Scriba Duo QA simulator is eligible.');
const container=execFileSync('xcrun',['simctl','get_app_container',device,'com.aeonbridge.scriba','data'],{encoding:'utf8'}).trim();
const directory=join(container,'Documents');
if(!existsSync(join(directory,'duo-posture-ready.json'))) throw new Error('Start the hosted passive posture test first.');
const command={id:`${Date.now()}-${label}`,label,...(posture?{expectPosture:posture}:{}),...(anchorPrefix?{anchorPrefix}:{}),...(label==='finish'?{finish:true}:{})};
const temporary=join(directory,'duo-posture-command.tmp');
writeFileSync(temporary,JSON.stringify(command));renameSync(temporary,join(directory,'duo-posture-command.json'));
if(label==='finish'){console.log('Passive session completion requested. Inspect the Xcode test result.');process.exit(0);}
for(let attempt=0;attempt<100;attempt++){
 const result=join(directory,'duo-posture-results.json');
 if(existsSync(result)){
  const snapshots=JSON.parse(readFileSync(result,'utf8'));
  if(snapshots.at(-1)?.label===label){
   const evidence='docs/evidence/iphone-duo-20261027';mkdirSync(evidence,{recursive:true});
   copyFileSync(result,join(evidence,'duo-posture-results.json'));
   copyFileSync(join(directory,`duo-posture-${label}.png`),join(evidence,`duo-posture-${label}.png`));
   console.log(JSON.stringify(snapshots.at(-1),null,2));process.exit(0);
  }
 }
 await pause(100);
}
throw new Error('The passive test did not acknowledge this capture within 10 seconds.');
