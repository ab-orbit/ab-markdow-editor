import { copyFileSync } from 'node:fs';
/** Reuse the same generated scribe artwork for Finder, the PWA and browser branding. */
copyFileSync(new URL('../public/icons/scribe-1024.png', import.meta.url), process.argv[2]);
