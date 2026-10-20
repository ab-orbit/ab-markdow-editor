import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
/** PDF layout already runs off-thread. Decode PNGs there instead of spawning CSP-blocked Blob workers. */
function pdfWorkerPngDecoder(): Plugin {
  return {
    name: 'scriba-pdf-worker-png-decoder', enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/pdfmake/build/pdfmake.js')) return;
      const start = code.indexOf('function unzlib(data, opts, cb) {');
      const end = code.indexOf('function unzlibSync(data, opts) {', start);
      // This adapter is specific to the pinned pdfmake/fflate bundle; upgrades must review its callback contract.
      if (start < 0 || end < start || code.indexOf('function unzlib(data, opts, cb) {', start + 1) !== -1) throw new Error('Review the pdfmake PNG decoder adapter after upgrading dependencies.');
      const replacement = `function unzlib(data, opts, cb) {
        if (typeof opts === 'function') { cb = opts; opts = {}; }
        if (typeof cb !== 'function') throw new Error('PNG decoder requires a callback.');
        let cancelled = false;
        queueMicrotask(function () {
          if (cancelled) return;
          let result, failure = null;
          try { result = unzlibSync(data, opts); } catch (error) { failure = error; }
          cb(failure, result);
        });
        return function () { cancelled = true; };
      }
      `;
      return {code:code.slice(0,start)+replacement+code.slice(end),map:null};
    },
  };
}
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

/** Self-host every SDK font, including Unicode subsets, and include them in the offline shell. */
function excalidrawFonts(): Plugin {
  const root = fileURLToPath(new URL('./node_modules/@excalidraw/excalidraw/dist/prod/fonts/', import.meta.url));
  return {
    name: 'scriba-excalidraw-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/@excalidraw\/excalidraw\/dist\/(?:prod|dev)\/chunk-[\w-]+\.js$/.test(id) || !code.includes('static createUrls(')) return;
      // The SDK always appends its public CDN even with ASSET_PATH configured.
      // Keep the supported local URL and remove that fallback, including from
      // FontFace construction (CSP validates every source before loading one).
      let count = 0;
      let next = code.replace(/return (\w+)\.push\(new URL\((\w+),(\w+)\.ASSETS_FALLBACK_URL\)\),\1/g, (_match, urls) => { count++; return `return ${urls}`; });
      next = next.replace(/\s*urls\.push\(new URL\(assetUrl, _ExcalidrawFontFace\.ASSETS_FALLBACK_URL\)\);/, () => { count++; return ''; });
      if (count !== 1) throw new Error('Review the Excalidraw local font adapter after updating the SDK.');
      return { code: next, map: null };
    },
    configureServer(server) {
      server.middlewares.use('/excalidraw/0.18.1/fonts/', (request, response, next) => {
        const relative = (request.url || '').split('?')[0];
        if (!/^[\w./-]+$/.test(relative) || relative.includes('..') || !existsSync(root + relative)) return next();
        response.setHeader('Content-Type', 'font/woff2'); createReadStream(root + relative).pipe(response);
      });
    },
    async generateBundle() {
      const visit = async (relative = ''): Promise<void> => {
        for (const item of await readdir(root + relative, { withFileTypes: true })) {
          const name = relative + item.name;
          if (item.isDirectory()) await visit(name + '/');
          else this.emitFile({ type: 'asset', fileName: `excalidraw/0.18.1/fonts/${name}`, source: readFileSync(root + name) });
        }
      };
      await visit();
    },
  };
}

export default defineConfig({
  plugins: [zenumlSvgOnly(), excalidrawFonts()],
  worker: {plugins: () => [pdfWorkerPngDecoder()]},
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version), __BUILD_DATE__: JSON.stringify(new Date().toISOString()) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The SDK is excluded so its font policy runs in development too. Its CJS
  // dependencies still need Vite's interoperability wrapper, including for the reference generator.
  optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', ...['@braintree/sanitize-url', '@excalidraw/laser-pointer', '@excalidraw/mermaid-to-excalidraw', '@radix-ui/react-popover', '@radix-ui/react-tabs', 'browser-fs-access', 'canvas-roundrect-polyfill', 'clsx', 'es6-promise-pool', 'fractional-indexing', 'fuzzy', 'image-blob-reduce', 'jotai', 'jotai-scope', 'lodash.debounce', 'lodash.throttle', 'nanoid', 'open-color', 'pako', 'perfect-freehand', 'pica', 'png-chunk-text', 'png-chunks-encode', 'png-chunks-extract', 'points-on-curve', 'roughjs/bin/generator', 'roughjs/bin/math', 'roughjs/bin/rough', 'tunnel-rat'].map(dependency => `@excalidraw/excalidraw > ${dependency}`)], exclude: ['@zenuml/core', '@excalidraw/excalidraw'] },
  build: { outDir: 'dist' },
});
