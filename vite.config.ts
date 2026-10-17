import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({ define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version), __BUILD_DATE__: JSON.stringify(new Date().toISOString()) }, resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, build: { outDir: 'dist' } });
