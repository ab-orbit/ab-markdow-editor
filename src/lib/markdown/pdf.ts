import { t, currentLanguage } from '../../i18n';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { RootContent, PhrasingContent, Definition, FootnoteDefinition } from 'mdast';
import type { Content, ContentText, TableCell } from 'pdfmake/interfaces';
import { resolveAsset, type MarkdownAsset } from './assets';
import { diagramIdentity, diagramKey, diagramLanguage, diagramSourceKey, renderDiagram, selectedDiagramEngine, usesZenUml, type DiagramAppearance } from './diagrams';
import { portableSvg } from './diagramExport';
import type { PdfJob, PdfPalette, PdfReply } from './pdfTypes';

interface Options {
  /** Snapshot of the current note, including edits not yet saved to its destination. */
  value: string;
  /** Registered local raster attachments; remote Markdown image URLs are not fetched. */
  assets: readonly MarkdownAsset[];
  /** Filename and diagram preferences belong to the same open document. */
  fileName: string;
  diagramScope: string;
  /** Cancellation ends raster preparation and terminates any active layout worker. */
  signal: AbortSignal;
  onProgress: (message: string) => void;
}
const WIDTH = 511.28, HEIGHT = 640;
const parser = unified().use(remarkParse).use(remarkGfm);
const plain = (nodes: readonly PhrasingContent[]): string => nodes.map(node => 'value' in node ? node.value : 'children' in node ? plain(node.children) : node.type === 'image' ? node.alt || '' : '').join('');
const cancelled = (signal: AbortSignal) => { if (signal.aborted) throw new DOMException(t("Exportação cancelada."), 'AbortError'); };
function base64(bytes: Uint8Array) { let value = ''; for (let index = 0; index < bytes.length; index += 8192) value += String.fromCharCode(...bytes.subarray(index, index + 8192)); return btoa(value); }

/** Resolve print colors from the application's light tokens without changing the user's theme. */
function printPalette(element: HTMLElement): PdfPalette {
  const css = getComputedStyle(element), color = (name: string) => css.getPropertyValue(name).trim();
  return { text: color('--reading-text'), heading: color('--reading-heading'), muted: color('--text-muted'), border: color('--reading-table-border'), stripe: color('--reading-table-stripe'), link: color('--cyan'), code: color('--diagram-code-background') };
}
async function raster(data: string, signal: AbortSignal, diagram = false): Promise<{ image: string; fit: [number, number] }> {
  cancelled(signal);
  const image = new Image(); image.src = data; await image.decode(); cancelled(signal);
  const width = image.naturalWidth, height = image.naturalHeight;
  if (!width || !height) throw new Error(t("Uma imagem não tem dimensões válidas para o PDF."));
  const fit: [number, number] = [Math.min(WIDTH, width * .75), HEIGHT];
  if (!diagram && /^data:image\/(?:png|jpeg);/i.test(data)) return { image: data, fit };
  const scale = Math.min(diagram ? 4 : 1, 2200 / width, 8192 / height, Math.sqrt(8_000_000 / (width * height)));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.ceil(width * scale)); canvas.height = Math.max(1, Math.ceil(height * scale));
  try { const context = canvas.getContext('2d'); if (!context) throw new Error(t("Não foi possível preparar uma imagem do PDF.")); context.drawImage(image, 0, 0, canvas.width, canvas.height); return { image: canvas.toDataURL('image/png'), fit }; }
  finally { canvas.width = canvas.height = 1; }
}
function layout(job: PdfJob, signal: AbortSignal): Promise<Blob> {
  cancelled(signal);
  const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const stop = () => { signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { stop(); reject(new DOMException(t("Exportação cancelada."), 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<PdfReply>) => { stop(); if ('error' in data) reject(new Error(data.error)); else resolve(new Blob([data.bytes], { type: 'application/pdf' })); };
    worker.onerror = event => { stop(); reject(new Error(event.message || t("Não foi possível preparar o PDF neste navegador."))); };
    worker.postMessage({...job, language: currentLanguage()});
  });
}

/** Build a portable PDF locally; source parsing, image loading and layout never write a note. */
export async function createMarkdownPdf({ value, assets, fileName, diagramScope, signal, onProgress }: Options): Promise<Blob> {
  cancelled(signal);
  const host = document.createElement('div'); host.dataset.theme = 'light'; host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', width: '800px', pointerEvents: 'none' }); document.body.append(host);
  try {
    const palette = printPalette(host), css = getComputedStyle(host), font = css.getPropertyValue('--font-ui').trim();
    const appearance: DiagramAppearance = { background: css.getPropertyValue('--reading-bg').trim(), foreground: palette.heading, muted: palette.muted, surface: palette.stripe, border: palette.muted, accent: palette.link, font, dark: false };
    const tree = parser.parse(value), definitions = new Map<string, Definition>(), footnotes = new Map<string, FootnoteDefinition>(), numbers = new Map<string, number>(), occurrences = new Map<string, number>();
    for (const node of tree.children) { if (node.type === 'definition') definitions.set(node.identifier, node); if (node.type === 'footnoteDefinition') footnotes.set(node.identifier, node); }
    function link(url?: string) { return url && /^(?:https?:\/\/|mailto:)/i.test(url) ? { link: url, color: palette.link, decoration: 'underline' as const } : {}; }
    function inline(nodes: readonly PhrasingContent[]): ContentText[] {
      return nodes.flatMap((node): ContentText[] => {
        switch (node.type) {
          case 'text': return [{ text: node.value }];
          case 'inlineCode': return [{ text: node.value, style: 'inlineCode' }];
          case 'strong': return [{ text: inline(node.children), bold: true }];
          case 'emphasis': return [{ text: inline(node.children), italics: true }];
          case 'delete': return [{ text: inline(node.children), decoration: 'lineThrough' }];
          case 'link': return [{ text: inline(node.children), ...link(node.url) }];
          case 'linkReference': return [{ text: inline(node.children), ...link(definitions.get(node.identifier)?.url) }];
          case 'break': return [{ text: '\n' }];
          case 'image': case 'imageReference': return [{ text: node.alt || '' }];
          case 'footnoteReference': { if (!numbers.has(node.identifier)) numbers.set(node.identifier, numbers.size + 1); return [{ text: `[${numbers.get(node.identifier)}]`, fontSize: 8, color: palette.link }]; }
          default: return [];
        }
      });
    }
    let totalDiagrams = 0, completedDiagrams = 0;
    function count(nodes: readonly RootContent[]) { for (const node of nodes) { if (node.type === 'code' && diagramLanguage(node.lang || '')) totalDiagrams++; if ('children' in node) count(node.children as RootContent[]); } } count(tree.children);
    async function picture(url: string, alt: string): Promise<Content[]> {
      const asset = resolveAsset(url, assets);
      if (!asset) return [{ text: `Imagem indisponível: ${alt || url}`, style: 'caption' }];
      const data = `data:${asset.file.type};base64,${base64(new Uint8Array(await asset.file.arrayBuffer()))}`;
      return [{ ...await raster(data, signal), margin: [0, 3, 0, 3] }, ...(alt ? [{ text: alt, style: 'caption' }] : [])];
    }
    async function diagram(source: string, language: NonNullable<ReturnType<typeof diagramLanguage>>): Promise<Content[]> {
      onProgress(t("Preparando diagramas… {0} de {1}", ++completedDiagrams, totalDiagrams)); cancelled(signal);
      let svg: string, fonts = '';
      if (language === 'excalidraw') {
        const { parseExcalidrawScene } = await import('./excalidrawScene'), scene = parseExcalidrawScene(source);
        if (!scene.elements.some(element => !element.isDeleted)) return [{ text: t("Quadro vazio"), style: 'caption' }];
        const [{ renderExcalidraw }, { excalidrawFontCss }] = await Promise.all([import('./excalidraw'), import('./excalidrawFonts')]);
        svg = await renderExcalidraw(source, false);
        fonts = await excalidrawFontCss(scene.elements.map(element => ({ type: String(element.type), fontFamily: Number(element.fontFamily) || 5, text: typeof element.text === 'string' ? element.text : '' })));
      } else {
        const key = `${language}:${diagramSourceKey(source)}`, ordinal = occurrences.get(key) || 0; occurrences.set(key, ordinal + 1);
        const preferred = selectedDiagramEngine(diagramKey(diagramIdentity(diagramScope, source, ordinal, language)));
        const engine = usesZenUml(source, language) ? 'zenuml' : preferred === 'zenuml' ? 'pele' : preferred;
        svg = (await renderDiagram(engine, source, appearance, 800)).svg;
      }
      cancelled(signal);
      host.innerHTML = svg; const element = host.querySelector('svg'); if (!element) throw new Error(t("O diagrama não produziu uma imagem válida."));
      await document.fonts.ready;
      const portable = portableSvg(element, fonts), data = URL.createObjectURL(new Blob([portable.source], { type: 'image/svg+xml;charset=utf-8' }));
      let result: Awaited<ReturnType<typeof raster>>;
      try { result = await raster(data, signal, true); } finally { URL.revokeObjectURL(data); host.replaceChildren(); }
      return [{ ...result, margin: [0, 6, 0, 14] }];
    }
    async function blocks(nodes: readonly RootContent[]): Promise<Content[]> {
      const output: Content[] = [];
      for (const node of nodes) {
        cancelled(signal);
        switch (node.type) {
          case 'heading': output.push({ text: inline(node.children), style: `h${Math.min(4, node.depth)}`, headlineLevel: node.depth }); break;
          case 'paragraph': {
            let run: PhrasingContent[] = [];
            const flush = () => { if (run.length) { output.push({ text: inline(run), style: 'paragraph' }); run = []; } };
            for (const child of node.children) {
              if (child.type === 'image' || child.type === 'imageReference') { flush(); output.push(...await picture(child.type === 'image' ? child.url : definitions.get(child.identifier)?.url || '', child.alt || '')); }
              else run.push(child);
            } flush(); break;
          }
          case 'blockquote': output.push({ stack: await blocks(node.children), margin: [14, 3, 0, 8], color: palette.muted }); break;
          case 'list': {
            const items: Content[] = [];
            for (const item of node.children) { const content = await blocks(item.children); if (item.checked !== null && item.checked !== undefined) content.unshift({ text: item.checked ? '[x]' : '[ ]', bold: true }); items.push({ stack: content }); }
            output.push(node.ordered ? { ol: items, start: node.start || 1, margin: [0, 0, 0, 8] } : { ul: items, margin: [0, 0, 0, 8] }); break;
          }
          case 'table': {
            const columns = Math.max(...node.children.map(row => row.children.length)), body: TableCell[][] = node.children.map((row, rowIndex) => Array.from({ length: columns }, (_, index) => ({ text: inline(row.children[index]?.children || []), bold: rowIndex === 0, fillColor: rowIndex === 0 || rowIndex % 2 === 0 ? palette.stripe : undefined, alignment: node.align?.[index] || 'left', margin: [0, 4, 0, 4] })));
            output.push({ table: { headerRows: 1, dontBreakRows: true, widths: Array(columns).fill('*'), body }, fontSize: columns > 5 ? 8.5 : 10, margin: [0, 3, 0, 14], layout: 'scribaTable' }); break;
          }
          case 'code': {
            const language = diagramLanguage(node.lang || '');
            if (language) {
              try { output.push(...await diagram(node.value, language)); }
              catch (cause) { cancelled(signal); output.push({ text: t("Diagrama não renderizado: {0}", cause instanceof Error ? t(cause.message) : t("revise o código.")), style: 'caption' }, { text: node.value, style: 'code', margin: [0, 0, 0, 12] }); }
            } else output.push({ table: { widths: ['*'], body: [[{ text: node.value, style: 'code', fillColor: palette.code, margin: [8, 8, 8, 8] }]] }, layout: 'noBorders', margin: [0, 3, 0, 14] });
            break;
          }
          case 'thematicBreak': output.push({ canvas: [{ type: 'line', x1: 0, x2: WIDTH, y1: 0, y2: 0, lineWidth: .5, lineColor: palette.border }], margin: [0, 8, 0, 16] }); break;
          // Raw HTML layouts are preserved in source exports but are not supported by this PDF renderer.
          case 'html': case 'definition': case 'footnoteDefinition': break;
        }
      }
      return output;
    }
    onProgress(t("Preparando PDF…"));
    const content = await blocks(tree.children);
    if (numbers.size) {
      content.push({ text: 'Referências', style: 'h2', headlineLevel: 2 });
      for (const [id, number] of numbers) { const note = footnotes.get(id); if (note) content.push({ text: `[${number}]`, bold: true, fontSize: 9 }, { stack: await blocks(note.children), margin: [12, 0, 0, 6] }); }
    }
    const response = await fetch('/icons/profile-v4/scribe-64.png', { signal }); if (!response.ok) throw new Error(t("Não foi possível carregar a logo do PDF."));
    const logo = `data:image/png;base64,${base64(new Uint8Array(await response.arrayBuffer()))}`;
    const titleNode = tree.children.find(node => node.type === 'heading'), title = titleNode?.type === 'heading' ? plain(titleNode.children) : fileName.replace(/\.[^.]+$/, '');
    cancelled(signal); onProgress(t("Finalizando páginas…"));
    return await layout({ content, title, logo, palette }, signal);
  } finally { host.remove(); }
}
