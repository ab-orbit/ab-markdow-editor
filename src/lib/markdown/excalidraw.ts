import { t } from '../../i18n';
import createDOMPurify from 'dompurify';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import { isEmbeddedRaster, parseExcalidrawScene } from './excalidrawScene';
import { downloadBlob } from './files';

let sdk: Promise<typeof import('@excalidraw/excalidraw')> | undefined;
/** Both preview and editing use the pinned official SDK, loaded on first visible drawing. */
export function loadExcalidraw() {
  (window as Window & { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/0.18.1/';
  return sdk ??= import('@excalidraw/excalidraw').catch(error => { sdk = undefined; throw error; });
}

export async function restoreExcalidraw(source: string) {
  const scene = parseExcalidrawScene(source);
  const [module, fonts] = await Promise.all([loadExcalidraw(), import('./excalidrawFonts')]);
  await fonts.ensureExcalidrawFonts(scene.elements as { type: string }[]);
  const restored = module.restore({ elements: scene.elements as unknown as ExcalidrawElement[], appState: scene.appState, files: scene.files as BinaryFiles }, null, null, { repairBindings: true });
  await document.fonts.ready;
  return { ...scene, elements: restored.elements, files: restored.files };
}

/** Keep only portable scene state and files actually used by live image elements. */
export function serializeExcalidraw(elements: readonly ExcalidrawElement[], appState: Partial<AppState>, files: BinaryFiles) {
  const scene = parseExcalidrawScene(JSON.stringify({ type: 'excalidraw', elements: elements.filter(element => !element.isDeleted), appState, files }));
  return JSON.stringify(scene, null, 2);
}

let purifier: ReturnType<typeof createDOMPurify> | undefined;
function safeSvg(value: string) {
  if (!purifier) {
    purifier = createDOMPurify(window);
    purifier.addHook('uponSanitizeAttribute', (node, data) => {
      if (/^(?:href|xlink:href)$/i.test(data.attrName) && !data.attrValue.startsWith('#') && !(node.nodeName.toLowerCase() === 'image' && isEmbeddedRaster(data.attrValue))) data.keepAttr = false;
      data.attrValue = data.attrValue.replace(/url\((?!['"]?#)[^)]*\)/gi, 'none');
    });
  }
  // A separate policy permits validated embedded raster images. Mermaid's stricter policy stays intact.
  const clean = purifier.sanitize(value, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'a', 'script', 'animate', 'set', 'style'] });
  const template = document.createElement('template'); template.innerHTML = clean;
  const svg = template.content.querySelector('svg');
  if (!svg || !svg.querySelector('path,rect,ellipse,text,image,line,polygon')) throw new Error(t("O desenho está vazio. Abra o editor visual para começar."));
  svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.maxWidth = '100%';
  const width = svg.viewBox.baseVal.width, sizes = [...svg.querySelectorAll('text')].map(text => parseFloat(text.getAttribute('font-size') || text.style.fontSize)).filter(value => value > 0);
  if (width && sizes.length) svg.dataset.diagramMinWidth = String(Math.min(1200, Math.ceil(width * Math.min(1, 14 / Math.min(...sizes)))));
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t("Desenho Excalidraw"));
  return svg.outerHTML;
}
const cache = new Map<string, string>(), pending = new Map<string, Promise<string>>();
let bytes = 0;
/** Shared, bounded preview cache; wheel zoom never calls the renderer again. */
export async function renderExcalidraw(source: string, dark: boolean): Promise<string> {
  const key = `${dark}:${source}`, hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  if (pending.has(key)) return pending.get(key)!;
  const job = (async () => {
    const [scene, module] = await Promise.all([restoreExcalidraw(source), loadExcalidraw()]);
    if (!scene.elements.some(element => !element.isDeleted)) throw new Error(t("O desenho está vazio. Abra o editor visual para começar."));
    const svg = await module.exportToSvg({ elements: scene.elements.filter(element => !element.isDeleted), files: scene.files, appState: { ...scene.appState, exportBackground: false, exportWithDarkMode: dark, exportEmbedScene: false }, exportPadding: 24, renderEmbeddables: false, skipInliningFonts: true });
    const result = safeSvg(svg.outerHTML);
    if (result.length < 4_000_000) {
      cache.set(key, result); bytes += key.length + result.length;
      while (cache.size > 16 || bytes > 12_000_000) { const oldest = cache.keys().next().value!; bytes -= oldest.length + cache.get(oldest)!.length; cache.delete(oldest); }
    }
    return result;
  })();
  pending.set(key, job);
  try { return await job; } finally { pending.delete(key); }
}

/** SDK export embeds fonts and raster images; the original canvas geometry is retained. */
export async function downloadExcalidraw(source: string, format: 'svg' | 'png' | 'excalidraw', dark: boolean) {
  const [scene, module] = await Promise.all([restoreExcalidraw(source), loadExcalidraw()]);
  if (format === 'excalidraw') {
    downloadBlob(new Blob([JSON.stringify(scene, null, 2)], { type: 'application/vnd.excalidraw+json' }), 'desenho.excalidraw'); return;
  }
  const elements = scene.elements.filter(element => !element.isDeleted);
  const options = { elements, files: scene.files, appState: { ...scene.appState, exportBackground: false, exportWithDarkMode: dark, exportEmbedScene: false }, exportPadding: 24 };
  if (format === 'svg') {
    const svg = await module.exportToSvg({ ...options, renderEmbeddables: false, skipInliningFonts: true });
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = await (await import('./excalidrawFonts')).excalidrawFontCss(elements); svg.prepend(style);
    downloadBlob(new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' }), 'desenho.svg');
  } else {
    const [left, top, right, bottom] = module.getCommonBounds(elements);
    const width = Math.max(1, right - left + 48), height = Math.max(1, bottom - top + 48);
    const scale = Math.min(2, 8192 / width, 8192 / height, Math.sqrt(16_000_000 / (width * height)));
    const canvas = await module.exportToCanvas({ ...options, getDimensions: () => ({ width: Math.ceil(width * scale), height: Math.ceil(height * scale), scale }) });
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error(t("Não foi possível exportar o PNG. Use SVG."))), 'image/png'));
      downloadBlob(blob, 'desenho.png');
    } finally { canvas.width = 1; canvas.height = 1; }
  }
}
