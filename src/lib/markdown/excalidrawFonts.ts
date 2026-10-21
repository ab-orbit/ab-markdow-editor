import { t } from '../../i18n';
import manifest from './excalidraw-fonts.json';

interface TextElement { type: string; fontFamily?: number; text?: string }
const faces = new Map<string, FontFace>(), data = new Map<string, Promise<string>>();
function contains(range: string | undefined, text: string) {
  if (!range) return true;
  const intervals = range.split(',').map(item => {
    const [start, end = start] = item.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(start.replace(/\?/g, '0'), 16), parseInt(end.replace(/\?/g, 'f'), 16)];
  });
  return [...text].some(char => intervals.some(([start, end]) => char.codePointAt(0)! >= start && char.codePointAt(0)! <= end));
}
function usedFaces(elements: readonly TextElement[]) {
  const families = new Map<number, string>();
  for (const element of elements) if (element.type === 'text') {
    const id = element.fontFamily || 5;
    families.set(id, (families.get(id) || '') + (element.text || ''));
    if (id === 5) families.set(100, (families.get(100) || '') + (element.text || ''));
  }
  return manifest.filter(face => families.has(face.id) && contains(face.descriptors?.unicodeRange, families.get(face.id)!));
}
/** Register only used Unicode subsets, from the pinned self-hosted SDK font distribution. */
export async function ensureExcalidrawFonts(elements: readonly TextElement[]) {
  await Promise.all(usedFaces(elements).map(async item => {
    let face = faces.get(item.uri);
    if (!face) { face = new FontFace(item.family, `url("/excalidraw/0.18.1/${item.uri}")`, item.descriptors || {}); faces.set(item.uri, face); document.fonts.add(face); }
    try { await face.load(); } catch { faces.delete(item.uri); document.fonts.delete(face); throw new Error(t("Não foi possível carregar uma fonte do desenho. Conecte o Scriba uma vez para concluir o cache offline.")); }
  }));
}
/** Portable SVG embeds the same complete Unicode subsets, without an eval/WASM/worker dependency. */
export async function excalidrawFontCss(elements: readonly TextElement[]) {
  return (await Promise.all(usedFaces(elements).map(async item => {
    let pending = data.get(item.uri);
    if (!pending) {
      pending = fetch(`/excalidraw/0.18.1/${item.uri}`).then(async response => {
        if (!response.ok) throw new Error(t("Não foi possível incorporar a fonte no SVG."));
        const bytes = new Uint8Array(await response.arrayBuffer()); let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return btoa(binary);
      }).catch(error => { data.delete(item.uri); throw error; });
      data.set(item.uri, pending);
    }
    const descriptors = item.descriptors;
    return `@font-face{font-family:"${item.family}";src:url("data:font/woff2;base64,${await pending}") format("woff2");${descriptors?.unicodeRange ? `unicode-range:${descriptors.unicodeRange};` : ''}font-weight:${descriptors?.weight || '400'};font-style:normal;}`;
  }))).join('\n');
}
