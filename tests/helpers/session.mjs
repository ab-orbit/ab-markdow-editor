/**
 * Read the per-process API capability that the local server injects into dist/index.html.
 * Fails with an actionable message when the web build is missing, instead of a TypeError
 * on a null regex match in every dependent test.
 */
export async function sessionToken(base) {
  const response = await fetch(base);
  const html = await response.text();
  const token = html.match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)?.[1];
  if (!token) throw new Error(`No API token at ${base} (HTTP ${response.status}): dist/index.html is missing or stale. Run \`npx vite build && node scripts/build-pwa.mjs\` (or \`npm run build\` on macOS) before \`npm test\`. Response: ${html.slice(0, 160)}`);
  return token;
}
