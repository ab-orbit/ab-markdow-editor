/**
 * Hands Finder "open document" requests to an editor window that is already open,
 * so a second Finder open reuses that window instead of launching another one.
 *
 * Open windows keep one authenticated long-poll (`next`). The launcher calls `offer`:
 * - a waiting window receives the id immediately;
 * - a window that polled within `presenceMs` (between two polls) gets it queued;
 * - otherwise `offer` returns false and the launcher opens a new window as before.
 */
export function createFinderRelay({ presenceMs = 4000, waitMs = 25000, now = Date.now } = {}) {
  /** Pending long-polls, oldest first: `{ resolve, timer }`. */
  const waiters = [];
  /** Ids accepted while no poll was pending; consumed by the next poll. */
  const queue = [];
  let lastPoll = -Infinity;

  return {
    /** Long-poll from an open window; resolves `{ id }` or `{ id: null }` after `waitMs`. */
    next(signal) {
      lastPoll = now();
      if (queue.length) return Promise.resolve({ id: queue.shift() });
      return new Promise(resolve => {
        const remove = () => { clearTimeout(waiter.timer); const index = waiters.indexOf(waiter); if (index >= 0) waiters.splice(index, 1); };
        const waiter = { resolve: value => { remove(); lastPoll = now(); resolve(value); } };
        waiter.timer = setTimeout(() => waiter.resolve({ id: null }), waitMs);
        // A closed window is gone: do not queue documents for it during the presence grace period.
        signal?.addEventListener('abort', () => { remove(); if (!waiters.length) lastPoll = -Infinity; resolve({ id: null }); }, { once: true });
        waiters.push(waiter);
      });
    },
    /** Returns true when an open window will load the document. */
    offer(id) {
      if (waiters.length) { waiters[0].resolve({ id }); return true; }
      if (now() - lastPoll < presenceMs) { queue.push(id); return true; }
      return false;
    },
    get listening() { return waiters.length > 0; },
  };
}
