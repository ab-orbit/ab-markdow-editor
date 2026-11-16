import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinderRelay } from '../server/finder-relay.mjs';

const id = 'cf75023a-0b84-4b87-9c5d-e2bfc24839ce';

test('without an open window the launcher is told to open a new one', () => {
  assert.equal(createFinderRelay().offer(id), false);
});

test('a listening window receives the document immediately', async () => {
  const relay = createFinderRelay();
  const poll = relay.next();
  assert.equal(relay.offer(id), true);
  assert.deepEqual(await poll, { id });
  assert.equal(relay.listening, false);
});

test('a document offered between two polls of an open window is queued for the next poll', async () => {
  let clock = 1000;
  const relay = createFinderRelay({ now: () => clock });
  relay.offer('ignored'); // no presence yet
  const first = relay.next(); assert.equal(relay.offer(id), true); await first;
  clock += 500;
  const queued = 'a0000000-0000-4000-8000-000000000000';
  assert.equal(relay.offer(queued), true);
  assert.deepEqual(await relay.next(), { id: queued });
  clock += 10000;
  assert.equal(relay.offer(id), false, 'a window that stopped polling is not present');
});

test('a closed window is forgotten at once, so the launcher opens a new window', async () => {
  const relay = createFinderRelay();
  const controller = new AbortController();
  const poll = relay.next(controller.signal);
  controller.abort();
  assert.deepEqual(await poll, { id: null });
  assert.equal(relay.offer(id), false);
});

test('an idle long-poll ends with no document and keeps the window present', async () => {
  let clock = 0;
  const relay = createFinderRelay({ waitMs: 10, now: () => clock });
  assert.deepEqual(await relay.next(), { id: null });
  assert.equal(relay.offer(id), true);
});
