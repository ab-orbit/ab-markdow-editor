import { randomBytes, createHash } from 'node:crypto';

/** One-time OAuth handoffs bind an ephemeral system-browser login to a native private session. */
export function nativeAuthentication(db, { encrypt, decrypt, origin }) {
  // id: public random flow identifier; client: hashed private native session; challenge: S256 verifier digest.
  // data: encrypted authorized account, available once; expires: absolute UTC milliseconds; started: replay guard.
  db.exec('CREATE TABLE IF NOT EXISTS native_handoffs (id TEXT PRIMARY KEY, client TEXT NOT NULL, challenge TEXT NOT NULL, data TEXT, expires INTEGER NOT NULL, started INTEGER NOT NULL DEFAULT 0)');
  const lookup = id => db.prepare('SELECT * FROM native_handoffs WHERE id=? AND expires>?').get(id, Date.now());
  return {
    cleanup() { db.prepare('DELETE FROM native_handoffs WHERE expires<?').run(Date.now()); },
    cancel(client) { db.prepare('DELETE FROM native_handoffs WHERE client=?').run(client); },
    start(client, challenge) {
      if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new Error('Verificador nativo inválido.');
      const id = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM native_handoffs WHERE expires<? OR client=?').run(Date.now(), client);
      db.prepare('INSERT INTO native_handoffs (id,client,challenge,expires) VALUES (?,?,?,?)').run(id, client, challenge, Date.now() + 600000);
      return { url: `${origin}/github/login?native=${id}`, state: id };
    },
    begin(id) {
      const row = lookup(id);
      if (!row || row.started) throw new Error('Autorização nativa expirada. Conecte novamente.');
      db.prepare('UPDATE native_handoffs SET started=1 WHERE id=?').run(id);
    },
    finish(id, account) {
      const row = lookup(id);
      if (!row || !row.started || row.data) throw new Error('Autorização nativa expirada.');
      db.prepare('UPDATE native_handoffs SET data=? WHERE id=?').run(encrypt(account), id);
      // The callback carries no credential, session cookie or transferable bearer token.
      return `com.aeonbridge.scriba://github/callback?state=${id}`;
    },
    claim(client, id, verifier) {
      const row = lookup(id);
      const challenge = typeof verifier === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(verifier)
        ? createHash('sha256').update(verifier).digest('base64url') : '';
      if (!row || row.client !== client || !row.data || row.challenge !== challenge) throw new Error('Autorização nativa inválida ou já utilizada.');
      db.prepare('DELETE FROM native_handoffs WHERE id=?').run(id);
      return decrypt(row.data);
    },
  };
}
