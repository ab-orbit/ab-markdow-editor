import { downloadBlob } from './files';

const vectorStyles = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stop-color', 'stop-opacity', 'color', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'text-decoration', 'text-transform', 'white-space', 'paint-order', 'visibility', 'display', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask', 'filter'];

/** Freeze the selected renderer's resolved styles so exported SVG works outside Scriba. */
export function portableSvg(original: SVGSVGElement, fontFaceCss = ''): { source: string; width: number; height: number } {
  const clone = original.cloneNode(true) as SVGSVGElement;
  const before = [original, ...original.querySelectorAll<SVGElement>('*')], after = [clone, ...clone.querySelectorAll<SVGElement>('*')];
  before.forEach((element, index) => {
    if (element.tagName.toLowerCase() === 'style') return;
    const css = getComputedStyle(element), target = after[index];
    for (const property of vectorStyles) {
      const value = css.getPropertyValue(property).replace(/url\(["']?[^)#]*#([^)'"\s]+)["']?\)/g, 'url(#$1)');
      if (value) target.style.setProperty(property, value);
    }
  });
  clone.querySelectorAll('style').forEach(element => element.remove());
  if (fontFaceCss) {
    const font = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    font.textContent = fontFaceCss; clone.prepend(font);
  }
  const box = original.viewBox.baseVal, bounds = original.getBoundingClientRect();
  const width = box.width || bounds.width, height = box.height || bounds.height;
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) throw new Error('O diagrama ainda não tem dimensões para exportar.');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(Math.ceil(width))); clone.setAttribute('height', String(Math.ceil(height)));
  if (!clone.hasAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  clone.style.removeProperty('max-width'); clone.style.removeProperty('width'); clone.style.removeProperty('height');
  clone.style.setProperty('background', 'transparent'); clone.style.setProperty('background-color', 'transparent');
  return { source: new XMLSerializer().serializeToString(clone), width, height };
}

/** Export the complete vector drawing, independent of the current viewport, pan and zoom. */
export async function downloadDiagram(element: SVGSVGElement, format: 'svg' | 'png', filename: string, fontFaceCss = ''): Promise<void> {
  await document.fonts?.ready;
  const { source, width, height } = portableSvg(element, fontFaceCss), blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  if (format === 'svg') { downloadBlob(blob, `${filename}.svg`); return; }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.decoding = 'async'; image.src = url; await image.decode();
    // Keep high-resolution exports within mobile canvas/memory limits. No background is painted.
    const scale = Math.min(2, 8192 / width, 8192 / height, Math.sqrt(16_000_000 / (width * height)));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.ceil(width * scale)); canvas.height = Math.max(1, Math.ceil(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Este navegador não conseguiu preparar o PNG. Use SVG.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível gerar o PNG. Use SVG.')), 'image/png'));
    downloadBlob(png, `${filename}.png`); canvas.width = 1; canvas.height = 1;
  } finally { URL.revokeObjectURL(url); }
}

/** Clipboard fallback keeps copying available in installed browsers with restricted clipboard APIs. */
export async function copyDiagramSource(source: string): Promise<void> {
  try { await navigator.clipboard.writeText(source); return; } catch { /* Use the user-activated selection fallback. */ }
  const textarea = document.createElement('textarea'); textarea.value = source; textarea.setAttribute('aria-label', 'Código do diagrama');
  Object.assign(textarea.style, { position: 'fixed', top: '0', left: '-10000px', fontSize: '16px' });
  document.body.append(textarea); textarea.select();
  try { if (!document.execCommand('copy')) throw new Error('Selecione o código e copie com o comando do seu dispositivo.'); }
  finally { textarea.remove(); }
}
