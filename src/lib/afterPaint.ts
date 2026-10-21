/** Allow the browser to paint the loading state before synchronous document preparation begins. */
export function afterPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
