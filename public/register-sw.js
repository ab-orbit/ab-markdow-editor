/* Start offline installation before React loads. Native iOS assets are already bundled. */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.scribaPwaRegistration = navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  // The editor observes this promise and displays availability; avoid an unhandled rejection if it loads later.
  window.scribaPwaRegistration.catch(() => {});
}
