import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { servicePlist } from '../scripts/local-service.mjs';

test('macOS service starts on login, recovers crashes and safely encodes installed paths', () => {
  const xml = servicePlist('/Applications/Scriba & Notes.app/Contents/Resources', '/tmp/notes', '/usr/bin:/bin');
  assert.match(xml, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(xml, /<key>KeepAlive<\/key><true\/>/);
  assert.match(xml, /Scriba &amp; Notes.app/);
  assert.match(xml, /<key>MARKDOWN_RUNTIME_FILE<\/key>/);
  if (process.platform === 'darwin') execFileSync('/usr/bin/plutil', ['-lint', '-'], { input: xml });
});
