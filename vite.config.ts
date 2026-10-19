import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
/** Use the public SVG API without injecting ZenUML's unrelated HTML editor stylesheet. */
function zenumlSvgOnly(): Plugin {
  return {
    name: 'scriba-zenuml-svg-only', enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/@zenuml/core/dist/zenuml.esm.mjs')) return;
      const end = code.indexOf('\n'), injector = code.slice(0, end);
      // Dependency upgrades must explicitly review this adapter rather than
      // silently introduce a document-wide stylesheet into the editor.
      if (!injector.startsWith('(function(){') || !injector.endsWith('})();') || !injector.includes('vite-plugin-css-injected-by-js')) throw new Error('Review the ZenUML SVG-only adapter after updating @zenuml/core.');
      // The published bundle wraps cloud icons in the namespace export C.
      // Vite's awaited-import destructuring optimization otherwise requests
      // `cloudIcons` from the outer module, before its .then selects C.
      // Select the namespace after awaiting, without a destructuring pattern.
      let icons = 0;
      const body = code.slice(end + 1).replace(/const \{ cloudIcons: (\w+) \} = await (import\(["']\.\/cloud-icons[^"']+["']\))\.then\(\((\w+)\) => \3\.C\);/g, (_match, name, load) => { icons++; return `const ${name} = (await ${load}).C.cloudIcons;`; });
      if (icons !== 2) throw new Error('Review the ZenUML cloud icon namespace adapter after updating @zenuml/core.');
      return { code: body, map: null };
    },
  };
}

export default defineConfig({
  plugins: [zenumlSvgOnly()],
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version), __BUILD_DATE__: JSON.stringify(new Date().toISOString()) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  optimizeDeps: { exclude: ['@zenuml/core'] },
  build: { outDir: 'dist' },
});
