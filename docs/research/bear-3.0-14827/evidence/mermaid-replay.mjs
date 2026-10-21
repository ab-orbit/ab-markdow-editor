/**
 * Controlled replay of Bear's installed Mermaid and MathJax web-view resources.
 * No Bear code is copied: a loopback-only, read-only server exposes the installed
 * resource directory and isolated browsers execute the exact packaged HTML/JS.
 * External network requests are blocked. This does not exercise Bear's native UI.
 * Run from the standalone editor with its existing Playwright dependency:
 * node docs/research/bear-3.0-14827/evidence/mermaid-replay.mjs
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';

const output = dirname(fileURLToPath(import.meta.url));
const root = resolve('/Applications/Bear.app/Contents/Frameworks/MDTextKitUI.framework/Versions/A/Resources');
const fixtures = [
  ['flowchart', 'flowchart LR\n  Start --> Finish'],
  ['graph-alias', 'graph TD\n  Start --> Finish'],
  ['sequence', 'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Received'],
  ['class', 'classDiagram\n  class Note {\n    +String title\n  }\n  Notebook "1" --> "*" Note'],
  ['state', 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Saved\n  Saved --> [*]'],
  ['state-legacy', 'stateDiagram\n  [*] --> Draft\n  Draft --> [*]'],
  ['er', 'erDiagram\n  NOTEBOOK ||--o{ NOTE : contains\n  NOTE {\n    int id PK\n    string title\n  }'],
  ['ed-typo', 'edDiagram\n  NOTEBOOK ||--o{ NOTE : contains'],
  ['gantt', 'gantt\n  title Release\n  dateFormat YYYY-MM-DD\n  section Work\n  Build :a1, 2026-10-01, 3d'],
  ['pie', 'pie title Notes\n  "Drafts" : 2\n  "Saved" : 5'],
  ['mindmap', 'mindmap\n  root((Notes))\n    Work\n    Personal'],
  ['timeline', 'timeline\n  title Releases\n  2025 : Draft\n  2026 : Release'],
  ['journey', 'journey\n  title Write a note\n  section Draft\n    Open : 5: User\n    Write : 4: User'],
  ['c4-context', 'C4Context\n  Person(user, "User")\n  System(app, "Notes")\n  Rel(user, app, "Writes")'],
  ['c4-container', 'C4Container\n  Person(user, "User")\n  Container(app, "Notes", "Web", "Editor")\n  Rel(user, app, "Writes")'],
  ['c4-component', 'C4Component\n  Component(editor, "Editor", "Web")\n  Component(store, "Store", "Disk")\n  Rel(editor, store, "Saves")'],
  ['c4-dynamic', 'C4Dynamic\n  Person(user, "User")\n  System(app, "Notes")\n  Rel(user, app, "Writes")'],
  ['c4-deployment', 'C4Deployment\n  Deployment_Node(device, "Device", "Mac") {\n    Container(app, "Notes", "Web", "Editor")\n  }'],
  ['sankey', 'sankey-beta\nDrafts,Saved,5\nDrafts,Archived,2'],
  ['xychart', 'xychart-beta\n  title "Notes"\n  x-axis [Mon, Tue, Wed]\n  y-axis "Count" 0 --> 10\n  bar [2, 5, 8]'],
  ['quadrant', 'quadrantChart\n  title Work\n  x-axis Low --> High\n  y-axis Low --> High\n  Task: [0.6, 0.7]'],
  ['gitgraph', 'gitGraph\n  commit\n  branch draft\n  checkout draft\n  commit'],
  ['requirement', 'requirementDiagram\n  requirement save_note {\n    id: 1\n    text: Save a note\n    risk: low\n    verifymethod: test\n  }'],
  ['packet', 'packet-beta\n  0-7: "Header"\n  8-15: "Body"'],
  ['architecture', 'architecture-beta\n  group app(cloud)[Notes]\n  service web(server)[Editor] in app\n  service db(database)[Store] in app\n  web:R -- L:db'],
  ['block', 'block-beta\n  columns 2\n  A["Editor"] B["Storage"]\n  A --> B'],
  ['kanban', 'kanban\n  todo[Todo]\n    task[Write a note]\n  done[Done]\n    saved[Save a note]'],
  ['radar', 'radar-beta\n  axis speed["Speed"], quality["Quality"], cost["Cost"]\n  curve release["Release"]{4, 5, 3}'],
  ['treemap', 'treemap-beta\n  "Notes"\n    "Work": 7\n    "Personal": 3'],
  ['treeview', 'treeView-beta\n  notes/\n    work/\n      draft.md\n    personal.md'],
  ['eventmodeling', 'eventmodeling\n  tf 01 ui Editor\n  tf 02 cmd SaveNote\n  tf 03 evt NoteSaved'],
  ['ishikawa', 'ishikawa-beta\n  Save failed\n  Network\n    Offline\n  Storage\n    Full disk'],
  ['venn', 'venn-beta\n  set Work: 10\n  set Personal: 8\n  union Work,Personal: 3'],
  ['wardley', 'wardley-beta\n  title Notes\n  component Editor [0.9, 0.6]\n  component Storage [0.4, 0.9]\n  Editor -> Storage'],
  ['cynefin', 'cynefin-beta\n  complex\n  "Explore note links"\n  clear\n  "Save a note"'],
  ['railroad', 'railroad-beta\n  note = sequence(terminal("#"), nonterminal("heading"));\n  heading = terminal("Notes");'],
  ['railroad-ebnf', 'railroad-ebnf-beta\n  note = "#" heading ;\n  heading = "Notes" ;'],
  ['railroad-abnf', 'railroad-abnf-beta\n  note = "#" heading ;\n  heading = "Notes" ;'],
  ['railroad-peg', 'railroad-peg-beta\n  note <- "#" heading ;\n  heading <- "Notes" ;'],
  ['swimlane', 'swimlane-beta LR\n  subgraph Author\n    A[Write]\n  end\n  subgraph Storage\n    B[Save]\n  end\n  A --> B'],
  ['flowchart-elk', 'flowchart-elk LR\n  Start --> Finish'],
  ['zenuml-not-registered', 'zenuml\nAlice->Bob: Hello'],
  ['usecase-not-registered', 'usecaseDiagram\nactor User'],
  ['info', 'info'],
];
const themes = {
  dark: { fontSize: 15, themeVariables: { fontFamily: 'BearSansUI', darkMode: true, background: '#1c1e1f', textColor: '#c4d1d8', primaryColor: '#313b41', primaryTextColor: '#d7e1e7', primaryBorderColor: '#78a9be', lineColor: '#9fb4bf' } },
  light: { fontSize: 15, themeVariables: { fontFamily: 'BearSansUI', darkMode: false, background: '#ffffff', textColor: '#202429' } },
};
const hash = data => createHash('sha256').update(data).digest('hex');
const report = {
  kind: 'controlled-resource-replay',
  limitations: [
    'This executes the exact installed HTML/JS resources in isolated browser engines; it does not drive Bear native UI or prove that every syntax is accepted by the native Markdown parser.',
    'Native-provided theme parameters are represented by declared test values; they are not claimed to be exact Bear theme values.',
    'All non-loopback network requests are aborted; screenshots and SVGs contain only analyst-authored fixtures.',
    'One successful fixture establishes that diagram family, not exhaustive grammar compatibility.',
  ],
  createdAt: new Date().toISOString(), root, fixtures, files: {}, engines: [],
};
for (const relative of ['mermaid/mermaid.html', 'mermaid/mermaid.js', 'mermaid/mermaid.min.js', 'mathjax/math.html', 'mathjax/math.js', 'mathjax/mathjax/tex-svg.js', 'mathjax/mathjax/core.js', 'mathjax/mathjax/startup.js']) {
  const bytes = await readFile(join(root, relative));
  report.files[relative] = { bytes: bytes.length, sha256: hash(bytes) };
}
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!path.startsWith(root + sep) || !['/mermaid/', '/mathjax/'].some(prefix => new URL(request.url, 'http://localhost').pathname.startsWith(prefix))) throw new Error('Outside allowed resource subtree');
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
await mkdir(output, { recursive: true });
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [name, engine, launch] of [['chromium', chromium, { channel: 'chrome' }], ['webkit', webkit, {}]]) {
    const browser = await engine.launch({ headless: true, ...launch });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      const run = { name, version: browser.version(), externalRequestsBlocked: [], resourceErrors: [], pageErrors: [], results: [] };
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        run.externalRequestsBlocked.push(route.request().url());
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      page.on('pageerror', error => run.pageErrors.push(String(error)));
      page.on('response', response => { if (response.status() >= 400) run.resourceErrors.push({ url: response.url().replace(origin, '<loopback>'), status: response.status() }); });
      await page.goto(`${origin}/mermaid/mermaid.html`);
      await page.evaluate(() => ensureMermaidLoaded());
      run.mermaid = await page.evaluate(async () => {
        await render('info', {});
        const svg = document.querySelector('#target svg');
        return { exports: Object.keys(mermaid), registry: mermaid.getRegisteredDiagramsMetadata(), infoText: svg?.querySelector('text')?.textContent?.trim(), initialConfig: mermaid.mermaidAPI.getConfig() };
      });
      for (const [id, code] of fixtures) {
        const result = await page.evaluate(async ({ id, code, options }) => {
          let parsed, detected;
          try { detected = mermaid.detectType(code); } catch (error) { detected = { error: String(error) }; }
          try { parsed = await mermaid.parse(code); } catch (error) { parsed = { error: String(error) }; }
          let dimensions;
          try { dimensions = await render(code, options); } catch (error) { dimensions = { error: String(error) }; }
          const svg = document.querySelector('#target svg');
          return { id, detected, parsed, dimensions, svgBytes: svg?.outerHTML.length || 0, svgText: svg?.textContent?.trim().slice(-500), hasSvg: !!svg, width: svg?.getAttribute('width'), height: svg?.getAttribute('height'), viewBox: svg?.getAttribute('viewBox') };
        }, { id, code, options: themes.dark });
        run.results.push(result);
        if (id === 'er' && result.hasSvg && !result.dimensions.error) {
          await writeFile(join(output, `mermaid-er-${name}.svg`), await page.locator('#target svg').evaluate(element => element.outerHTML));
          await page.locator('#target').screenshot({ path: join(output, `mermaid-er-${name}.png`) });
        }
        if (process.env.VERBOSE_REPLAY === '1') console.log(`${name} ${id}: ${result.dimensions.error || (result.hasSvg ? 'SVG' : 'NO SVG')}`);
      }
      await page.evaluate(({ code, options }) => render(code, options), { code: fixtures.find(([id]) => id === 'eventmodeling')[1], options: themes.light });
      await writeFile(join(output, `mermaid-eventmodeling-${name}.svg`), await page.locator('#target svg').evaluate(element => element.outerHTML));
      if (name === 'chromium') await page.locator('#target').screenshot({ path: join(output, 'mermaid-eventmodeling-chromium.png') });
      run.themeSwitch = await page.evaluate(() => ({ background: document.body.style.background, overrideRulesPresent: !!document.querySelector('#md-mermaid-overrides'), font: getComputedStyle(document.querySelector('#target')).fontFamily }));
      await page.goto(`${origin}/mathjax/math.html`);
      run.mathjax = await page.evaluate(async () => {
        await MathJax.startup.promise;
        return { version: MathJax.version, loader: MathJax.config.loader, texPackages: MathJax.config.tex.packages, options: MathJax.config.options, exports: Object.keys(MathJax) };
      });
      try {
        await page.evaluate(() => ensureMathjaxLoaded());
      } catch (error) { run.mathjax.initializationError = String(error); }
      run.mathjax.examples = [];
      for (const [id, code] of [['fraction', String.raw`\frac{a}{b}`], ['mhchem', String.raw`\ce{H2O}`], ['physics', String.raw`\dv{x}{t}`]]) {
          const result = await page.evaluate(async ({ id, code }) => {
            try {
              const result = render(code, { block: true, fontSize: 18 });
              return { id, result, svg: !!document.querySelector('svg'), textNodes: [...document.querySelectorAll('svg text')].map(element => element.textContent), errors: [...document.querySelectorAll('[data-mjx-error]')].map(element => element.getAttribute('data-mjx-error')), undefinedTextNodes: [...document.querySelectorAll('[data-mml-node="mtext"]')].map(element => ({ text: element.textContent, color: element.getAttribute('fill') || element.getAttribute('color') })) };
            } catch (error) { return { id, error: String(error) }; }
          }, { id, code });
          run.mathjax.examples.push(result);
      }
      report.engines.push(run);
      await context.close();
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
  await writeFile(join(output, 'mermaid-replay-results.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ output: join(output, 'mermaid-replay-results.json'), engines: report.engines.map(run => ({ name: run.name, fixtures: run.results.length, rendered: run.results.filter(result => result.hasSvg && !result.dimensions.error).length, failed: run.results.filter(result => result.dimensions.error).map(result => result.id), externalRequestsBlocked: run.externalRequestsBlocked.length, mathjaxVersion: run.mathjax?.version })) }, null, 2));
