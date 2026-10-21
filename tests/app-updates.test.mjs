import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareVersions,availableStoreUpdate,APP_STORE_URL} from '../src/lib/appUpdates.ts';
test('store versions compare numerically and reject invalid metadata',()=>{
 assert.equal(compareVersions('1.10.0','1.9.9'),1);
 assert.equal(compareVersions('1.16','1.16.0'),0);
 assert.equal(compareVersions('2','10'),-1);
 for(const version of ['','x.2','1.2-beta','1.2.3.4.5','-1.0'])assert.equal(compareVersions(version,'1.0'),null);
});
test('App Store updates require a newer published version of the exact app',()=>{
 const info={channel:'app-store',version:'1.16.1',build:'13',catalog:{results:[{trackId:6824664840,bundleId:'com.aeonbridge.scriba',version:'1.17.0',trackViewUrl:'https://untrusted.example'}]}};
 assert.deepEqual(availableStoreUpdate(info),{channel:'app-store',version:'1.17.0'});
 assert.equal(APP_STORE_URL,'https://apps.apple.com/app/id6824664840');
 for(const patch of [{version:'1.16.1'},{version:'1.0'},{bundleId:'other.app'},{trackId:1},{version:'invalid'}])assert.equal(availableStoreUpdate({...info,catalog:{results:[{...info.catalog.results[0],...patch}]}}),null);
 assert.equal(availableStoreUpdate({...info,catalog:{results:[]}}),null);
});
test('TestFlight compares build numbers within a version and requires explicit testing promotion',()=>{
 const info={channel:'testflight',version:'1.16.1',build:'9',catalog:{schema:1,testflight:{version:'1.16.1',build:'13',status:'testing',expiresAt:new Date(Date.now()+86400000).toISOString()}}};
 assert.deepEqual(availableStoreUpdate(info),{channel:'testflight',version:'1.16.1',build:'13'});
 for(const patch of [{build:'9'},{build:'8'},{status:'processing'},{expiresAt:'2000-01-01T00:00:00Z'},{expiresAt:'invalid'},{build:'invalid'},{version:'1.15.0',build:'100'}])assert.equal(availableStoreUpdate({...info,catalog:{schema:1,testflight:{...info.catalog.testflight,...patch}}}),null);
 assert.equal(availableStoreUpdate({...info,channel:'development'}),null);
 assert.equal(availableStoreUpdate({...info,catalog:null}),null);
 assert.equal(availableStoreUpdate({...info,catalog:{schema:2,testflight:info.catalog.testflight}}),null);
});
