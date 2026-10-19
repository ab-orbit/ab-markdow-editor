import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createGitHubService } from '../server/github/service.mjs';

test('native OAuth HTTP: isolated browser login, verifier binding, expiry, encrypted credentials and one-time redemption', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'scriba-native-auth-'));
  const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const secret = 'github_native_fixture_token_not_a_real_credential';
  const service = createGitHubService({ directory, origin, secure: false, setupKey: 'fixture-setup', fetcher: async (url, options) => {
    if(url.includes('/app-manifests/'))return Response.json({ client_id:'fixture-client',client_secret:'fixture-secret',slug:'fixture-app' });
    if(url.includes('/access_token')) { assert.ok(JSON.parse(options.body).code_verifier); return Response.json({access_token:secret}); }
    if(url.endsWith('/user')) { assert.equal(options.headers.Authorization, `Bearer ${secret}`); return Response.json({login:'fixture-author',id:7}); }
    throw new Error(`Unexpected fixture request ${url}`);
  }});
  await new Promise(resolve => service.server.listen(port, '127.0.0.1', resolve));
  const client = () => {
    let cookie = '';
    return async (route, body, headers={}) => {
      const response = await fetch(`${origin}/github/${route}`, {method:body === undefined ? 'GET':'POST', redirect:'manual', headers:{Cookie:cookie,...(body === undefined ? {} : {Origin:origin,'X-Scriba-Client':'1','Content-Type':'application/json'}),...headers}, body:body === undefined ? undefined:JSON.stringify(body)});
      cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
      const text = await response.text(); return {status:response.status,text,location:response.headers.get('location'),json:()=>JSON.parse(text)};
    };
  };
  const native = client(), browser = client(), attacker = client(), admin = client();
  try {
    const setup = await admin('setup?key=fixture-setup');
    const setupState = setup.text.match(/apps\/new\?state=([a-f0-9]+)/)[1];
    assert.equal((await admin(`setup/callback?state=${setupState}&code=fixture-manifest`)).status,302);
    const verifier = randomBytes(32).toString('base64url'), challenge = createHash('sha256').update(verifier).digest('base64url');
    assert.equal((await native('native/start',{challenge:'bad'})).status,400);
    assert.equal((await native('native/start',{challenge},{Origin:'https://attacker.invalid'})).status,403);
    const flow = (await native('native/start',{challenge})).json();
    const authorize = await browser(flow.url.split('/github/')[1]);
    assert.equal(authorize.status,302);
    assert.equal((await attacker(flow.url.split('/github/')[1])).status,400);
    const state = new URL(authorize.location).searchParams.get('state');
    assert.equal((await browser('callback?state=wrong&code=fixture-code')).status,403);
    const callback = await browser(`callback?state=${state}&code=fixture-code`);
    assert.equal(callback.location,`com.aeonbridge.scriba://github/callback?state=${flow.state}`);
    assert.ok(!callback.location.includes(secret));
    assert.equal((await browser('status')).json().connected,false);
    assert.equal((await native('status')).json().connected,false);
    assert.equal((await attacker('native/complete',{state:flow.state,verifier})).status,400);
    assert.equal((await native('native/complete',{state:flow.state,verifier:randomBytes(32).toString('base64url')})).status,400);
    assert.equal((await native('native/complete',{state:flow.state,verifier})).status,200);
    assert.equal((await native('status')).json().user.login,'fixture-author');
    assert.equal((await native('native/complete',{state:flow.state,verifier})).status,400);
    assert.equal((await attacker('status')).json().connected,false);
    const expired = (await native('native/start',{challenge})).json();
    const database = new DatabaseSync(path.join(directory,'sessions.sqlite'));
    database.prepare('UPDATE native_handoffs SET expires=0 WHERE id=?').run(expired.state); database.close();
    assert.equal((await browser(expired.url.split('/github/')[1])).status,400);
    assert.equal((await native('logout',{})).status,200);
    assert.equal((await native('status')).json().connected,false);
    for(const file of ['sessions.sqlite','sessions.sqlite-wal']) { const bytes = await readFile(path.join(directory,file)).catch(()=>Buffer.alloc(0)); assert.ok(!bytes.includes(Buffer.from(secret))); }
  } finally { await new Promise(resolve=>service.server.close(resolve));service.close();await rm(directory,{recursive:true,force:true}); }
});
