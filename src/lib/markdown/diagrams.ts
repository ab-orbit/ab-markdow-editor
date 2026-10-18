import createDOMPurify from 'dompurify';

/** Renderer choices affect presentation only; Markdown remains the saved source. */
export type DiagramEngine = 'mermaid' | 'pele' | 'beautiful';
export const diagramEngines = [
  { id: 'mermaid', label: 'Mermaid', version: '12.2.0' },
  { id: 'pele', label: 'Pele', version: '1.6.0' },
  { id: 'beautiful', label: 'Beautiful Mermaid', version: '1.1.3' },
] as const;

/** Colors and text metrics are resolved from the existing application tokens. */
export interface DiagramAppearance {
  background: string;
  foreground: string;
  muted: string;
  surface: string;
  border: string;
  accent: string;
  font: string;
  dark: boolean;
}
/** A cached drawing, with engine execution time excluding import/font loading. */
export interface DiagramResult { svg: string; milliseconds: number; cached: boolean }

const drawings = new Map<string, Omit<DiagramResult, 'cached'>>();
const pending = new Map<string, Promise<Omit<DiagramResult, 'cached'>>>();
const MAX_CACHE_BYTES = 12_000_000;
const MAX_CACHE_ENTRIES = 24;
let cacheBytes = 0;
let serial = 0;
let mermaidQueue: Promise<unknown> = Promise.resolve();
let mermaidImport: Promise<typeof import('mermaid')> | undefined;
let peleImport: Promise<typeof import('pele')> | undefined;
let beautifulImport: Promise<typeof import('beautiful-mermaid')> | undefined;
let purifier: ReturnType<typeof createDOMPurify> | undefined;

/** Keep local SVG definitions while blocking resources outside the document. */
function localPaints(css: string) {
  return css.replace(/@import\s+[^;]+;?/gi, '').replace(/url\(([^)]*)\)/gi, (whole, target: string) => {
    const reference = target.trim().replace(/^['"]|['"]$/g, '');
    return reference.startsWith('#') ? whole : 'none';
  });
}
function svgPurifier() {
  if (!purifier) {
    purifier = createDOMPurify(window);
    purifier.addHook('uponSanitizeAttribute', (_node, data) => {
      if (/^(?:href|xlink:href)$/i.test(data.attrName) && !data.attrValue.startsWith('#')) data.keepAttr = false;
      if (data.attrName === 'style') data.attrValue = localPaints(data.attrValue);
    });
  }
  return purifier;
}

/** Sanitize renderer output separately from ordinary Markdown HTML. */
function cleanSvg(svg: string) {
  if (svg.length > 4_000_000) throw new Error('O diagrama ficou muito grande. Divida-o em blocos menores.');
  const clean = svgPurifier().sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'image', 'a', 'script', 'animate', 'set'] });
  const template = document.createElement('template'); template.innerHTML = clean;
  const root = template.content.querySelector('svg');
  if (!root) throw new Error('O renderizador não produziu um diagrama SVG.');
  if (!root.id) root.id = `scriba-svg-${++serial}`;
  // Inline SVG styles are document-wide unless scoped. Beautiful's generic
  // text/svg rules must never restyle another renderer or the editor's icons.
  root.querySelectorAll('style').forEach(style => {
    const sheet = new CSSStyleSheet(); sheet.replaceSync(localPaints(style.textContent || ''));
    const scope = (rules: CSSRuleList) => {
      for (const rule of [...rules]) {
        if (rule instanceof CSSStyleRule) rule.selectorText = `:is(${rule.selectorText}):is(#${root.id}, #${root.id} *)`;
        else if ('cssRules' in rule) scope((rule as CSSGroupingRule).cssRules);
      }
    };
    scope(sheet.cssRules); style.textContent = [...sheet.cssRules].map(rule => rule.cssText).join('\n');
  });
  const naturalWidth = Number(root.getAttribute('viewBox')?.split(/[\s,]+/)[2]);
  if (naturalWidth > 0 && Number.isFinite(naturalWidth)) root.style.maxWidth = `${naturalWidth}px`;
  return root.outerHTML;
}

/** Cached SVGs need fresh definition IDs when mounted in multiple previews. */
export function scopeDiagramSvg(svg: string, prefix: string) {
  const template = document.createElement('template'); template.innerHTML = svg;
  const root = template.content.querySelector('svg')!;
  const elements = [root, ...root.querySelectorAll<SVGElement>('*')];
  const ids = new Map<string, string>();
  for (const element of elements) if (element.id) ids.set(element.id, `${prefix}-${ids.size}`);
  for (const element of elements) {
    for (const attribute of [...element.attributes]) {
      let value = attribute.value;
      if (attribute.name === 'id') value = ids.get(value) || value;
      else if (/^(?:aria-labelledby|aria-describedby)$/.test(attribute.name)) value = value.split(/\s+/).map(id => ids.get(id) || id).join(' ');
      else if (/^(?:href|xlink:href)$/.test(attribute.name) && value.startsWith('#')) value = `#${ids.get(value.slice(1)) || value.slice(1)}`;
      else value = value.replace(/url\(['"]?#([^)'"\s]+)['"]?\)/g, (_whole, id: string) => `url(#${ids.get(id) || id})`);
      element.setAttribute(attribute.name, value);
    }
  }
  for (const style of root.querySelectorAll('style')) {
    let css = style.textContent || '';
    for (const [before, after] of ids) {
      const escaped = before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      css = css.replace(new RegExp(`#${escaped}(?![\\w-])`, 'g'), `#${after}`);
    }
    style.textContent = css;
  }
  return root.outerHTML;
}

async function loadRenderer(engine: DiagramEngine) {
  if (engine === 'mermaid') return (mermaidImport ??= import('mermaid').catch(error => { mermaidImport = undefined; throw error; }));
  if (engine === 'pele') return (peleImport ??= import('pele').catch(error => { peleImport = undefined; throw error; }));
  return (beautifulImport ??= import('beautiful-mermaid').catch(error => { beautifulImport = undefined; throw error; }));
}

/** Execute Mermaid jobs in order because initialize() changes shared configuration. */
async function draw(engine: DiagramEngine, source: string, appearance: DiagramAppearance, width: number) {
  if (engine === 'beautiful' && !/^(?:graph|flowchart|stateDiagram(?:-v2)?|sequenceDiagram|classDiagram|erDiagram|xychart(?:-beta)?)$/i.test(source.trimStart().split(/\s+/)[0])) {
    throw new Error('Beautiful Mermaid não suporta este tipo de diagrama. Experimente Mermaid ou Pele.');
  }
  const library = await loadRenderer(engine);
  await document.fonts?.ready;
  const id = `scriba-diagram-${++serial}`;
  const execute = async () => {
    const start = performance.now();
    let svg: string;
    if (engine === 'mermaid') {
      const mermaid = (library as typeof import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: 'base', look: 'classic', htmlLabels: false,
        maxTextSize: 50_000, maxEdges: 1_000, fontFamily: appearance.font,
        themeVariables: {
          darkMode: appearance.dark, background: appearance.background, fontFamily: appearance.font, fontSize: '15px',
          primaryColor: appearance.surface, primaryTextColor: appearance.foreground, primaryBorderColor: appearance.border,
          secondaryColor: appearance.surface, secondaryTextColor: appearance.foreground,
          tertiaryColor: appearance.surface, tertiaryTextColor: appearance.foreground,
          lineColor: appearance.muted, textColor: appearance.foreground, mainBkg: appearance.surface,
          nodeBorder: appearance.border, edgeLabelBackground: appearance.background,
          clusterBkg: appearance.background, clusterBorder: appearance.border,
          actorBkg: appearance.surface, actorTextColor: appearance.foreground, actorBorder: appearance.border,
          signalColor: appearance.foreground, signalTextColor: appearance.foreground,
        },
      });
      const staging = document.createElement('div');
      staging.setAttribute('aria-hidden', 'true'); staging.dataset.diagramStaging = '';
      Object.assign(staging.style, { position: 'fixed', left: '-100000px', top: '0', width: `${width}px`, visibility: 'hidden', pointerEvents: 'none', fontFamily: appearance.font });
      document.body.append(staging);
      try { svg = (await mermaid.render(id, source, staging)).svg; }
      finally { staging.remove(); }
    } else if (engine === 'pele') {
      svg = (library as typeof import('pele')).render(source, {
        idPrefix: id, fontFamily: appearance.font, fontSize: 15, maxWidth: width,
        images: false, links: false, limit: 50_000, maxEdges: 1_000,
      }).svg;
    } else {
      svg = (library as typeof import('beautiful-mermaid')).renderMermaidSVG(source, {
        bg: 'var(--diagram-bg)', fg: 'var(--diagram-fg)', line: 'var(--text-muted)',
        accent: 'var(--cyan)', muted: 'var(--text-muted)', surface: 'var(--bg-elevated)',
        border: 'var(--text-muted)', font: appearance.font.split(',')[0].replace(/["']/g, '').trim(),
        transparent: true, padding: 24,
      });
    }
    const milliseconds = performance.now() - start;
    return { svg: cleanSvg(svg), milliseconds };
  };
  if (engine !== 'mermaid') return execute();
  const result = mermaidQueue.then(execute);
  mermaidQueue = result.catch(() => undefined);
  return result;
}

/** Share bounded results and pending work; a failed renderer never becomes a cached success. */
export async function renderDiagram(engine: DiagramEngine, source: string, appearance: DiagramAppearance, width: number): Promise<DiagramResult> {
  if (source.length > 50_000) throw new Error('Este bloco excede 50 mil caracteres. Divida o diagrama em blocos menores.');
  const safeWidth = Math.max(200, Math.min(1_600, Math.round(width / 8) * 8));
  const key = JSON.stringify([engine, source, engine === 'mermaid' ? appearance : {font: appearance.font}, safeWidth]);
  const cached = drawings.get(key);
  if (cached) { drawings.delete(key); drawings.set(key, cached); return { ...cached, cached: true }; }
  let job = pending.get(key);
  if (!job) {
    job = draw(engine, source, appearance, safeWidth).then(result => {
      drawings.set(key, result); cacheBytes += result.svg.length * 2;
      while (drawings.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) {
        const oldest = drawings.keys().next().value!;
        cacheBytes -= drawings.get(oldest)!.svg.length * 2; drawings.delete(oldest);
      }
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, job);
  }
  return { ...await job, cached: false };
}

const PREFERENCE_KEY = 'scriba-diagram-engines-v1';
const listeners = new Set<() => void>();
let preferences: Record<string, DiagramEngine> | undefined;
/** Hash only presentation keys; do not duplicate note text in localStorage. */
export function diagramKey(source: string) {
  let a = 2166136261, b = 5381;
  for (let index = 0; index < source.length; index++) { const char = source.charCodeAt(index); a = Math.imul(a ^ char, 16777619); b = Math.imul(b, 33) ^ char; }
  return `${source.length}-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}
function readPreferences() {
  if (!preferences) {
    try { preferences = JSON.parse(localStorage.getItem(PREFERENCE_KEY) || '{}'); } catch { preferences = {}; }
    if (!preferences || Array.isArray(preferences) || typeof preferences !== 'object') preferences = {};
  }
  return preferences;
}
export function selectedDiagramEngine(key: string): DiagramEngine {
  const value = readPreferences()[key];
  return diagramEngines.some(engine => engine.id === value) ? value : 'mermaid';
}
export function setDiagramEngine(key: string, engine: DiagramEngine) {
  const values = readPreferences(); delete values[key]; values[key] = engine;
  const keys = Object.keys(values); for (const old of keys.slice(0, Math.max(0, keys.length - 100))) delete values[old];
  try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(values)); } catch { /* Storage restrictions do not prevent comparing diagrams. */ }
  listeners.forEach(listener => listener());
}
export function subscribeDiagramEngine(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
