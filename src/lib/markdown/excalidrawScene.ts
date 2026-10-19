/** Portable Excalidraw JSON, independent of the browser-only drawing SDK. */
export interface ExcalidrawScene {
  /** Standard open-format discriminator understood by the official editor. */
  type: 'excalidraw';
  /** Current Excalidraw scene file format version. */
  version: 2;
  /** Producing application name; this is never a synchronization destination. */
  source: string;
  /** Ordered, portable SDK elements, including bindings, groups and frames. */
  elements: Record<string, any>[];
  /** Canvas appearance and grid settings, excluding transient editor state. */
  appState: Record<string, any>;
  /** Embedded raster files keyed by the identifiers referenced by image elements. */
  files: Record<string, any>;
}

export const EMPTY_EXCALIDRAW = JSON.stringify({ type: 'excalidraw', version: 2, source: 'Scriba', elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} });
const types = new Set(['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'text', 'freedraw', 'image', 'frame']);
const raster = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\r\n]+$/;

/** Only embedded raster data is permitted; opening a note never fetches remote images. */
export function isEmbeddedRaster(value: unknown): value is string {
  if (typeof value !== 'string' || !raster.test(value)) return false;
  try {
    const [header, content] = value.split(','), bytes = atob(content.replace(/\s/g, '').slice(0, 32));
    return header.includes('/png;') ? bytes.startsWith('\x89PNG\r\n\x1a\n') : header.includes('/jpeg;') ? bytes.startsWith('\xff\xd8\xff') : header.includes('/gif;') ? /^GIF8[79]a/.test(bytes) : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  } catch { return false; }
}

/** Validate before passing untrusted note/file contents to the canvas or export API. */
export function parseExcalidrawScene(source: string): ExcalidrawScene {
  if (source.length > 8_000_000) throw new Error('O desenho excede 8 MB. Reduza as imagens antes de importar.');
  let value: any;
  try { value = JSON.parse(source); } catch { throw new Error('JSON inválido. Importe um arquivo .excalidraw ou corrija o código do desenho.'); }
  if (!value || value.type !== 'excalidraw' || !Array.isArray(value.elements)) throw new Error('Use uma cena Excalidraw com type: "excalidraw" e uma lista elements.');
  if (value.elements.length > 2_000) throw new Error('O desenho excede 2.000 elementos. Divida-o em cenas menores.');
  function inspect(item: any, depth = 0): void {
    if (depth > 32) throw new Error('A estrutura do desenho é muito profunda.');
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('O desenho contém dimensões inválidas.');
    if (!item || typeof item !== 'object') return;
    for (const [key, next] of Object.entries(item)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('O desenho contém propriedades inválidas.');
      inspect(next, depth + 1);
    }
  }
  inspect(value);
  const ids = new Set<string>();
  for (const element of value.elements) {
    if (!element || !types.has(element.type)) throw new Error('Este desenho contém um elemento não suportado. Use formas, texto, setas, frames e imagens locais; incorporações de sites não são carregadas.');
    if (typeof element.id !== 'string' || !element.id || ids.has(element.id)) throw new Error('Cada elemento precisa de um id único.');
    ids.add(element.id);
    if (!Number.isFinite(element.x) || !Number.isFinite(element.y)) throw new Error('Um elemento não tem posição válida.');
    for (const key of ['width', 'height', 'angle', 'opacity', 'strokeWidth', 'roughness']) if (element[key] !== undefined && !Number.isFinite(element[key])) throw new Error('Um elemento contém dimensões ou estilo inválidos.');
    for (const key of ['x', 'y', 'width', 'height']) if (Math.abs(element[key] || 0) > 1_000_000) throw new Error('O desenho contém dimensões em excesso.');
    if (element.link && !/^(?:https?:\/\/|mailto:|#)/i.test(element.link)) throw new Error('Use links HTTP, HTTPS, e-mail ou âncoras nos elementos.');
    if (element.type === 'text' && typeof element.text !== 'string') throw new Error('Um elemento de texto está incompleto.');
    if (['arrow', 'line', 'freedraw'].includes(element.type) && (!Array.isArray(element.points) || element.points.length > 20_000 || element.points.some((point: any) => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)))) throw new Error('Um traço contém pontos inválidos ou em excesso.');
  }
  const files: Record<string, any> = {};
  for (const element of value.elements) {
    if (element.type !== 'image' || element.isDeleted) continue;
    const file = value.files?.[element.fileId];
    if (!file || !isEmbeddedRaster(file.dataURL) || !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mimeType)) throw new Error('Inclua as imagens no arquivo como PNG, JPEG, GIF ou WebP. URLs externas e imagens SVG não são carregadas.');
    files[element.fileId] = { id: element.fileId, dataURL: file.dataURL, mimeType: file.mimeType, created: Number(file.created) || 1, lastRetrieved: Number(file.lastRetrieved) || 1 };
  }
  // Runtime state (selection, file handles, collaborators, viewport) is never imported.
  const appState: Record<string, any> = {};
  for (const key of ['viewBackgroundColor', 'gridSize', 'gridStep', 'gridModeEnabled', 'objectsSnapModeEnabled']) if (value.appState?.[key] !== undefined) appState[key] = value.appState[key];
  for (const key of ['gridSize', 'gridStep']) if (appState[key] !== undefined && (!Number.isFinite(appState[key]) || appState[key] < 1 || appState[key] > 1000)) delete appState[key];
  for (const key of ['gridModeEnabled', 'objectsSnapModeEnabled']) if (typeof appState[key] !== 'boolean') delete appState[key];
  if (typeof appState.viewBackgroundColor !== 'string' || !/^(?:#[\da-f]{3,8}|transparent)$/i.test(appState.viewBackgroundColor)) appState.viewBackgroundColor = '#ffffff';
  return { type: 'excalidraw', version: 2, source: 'Scriba', elements: value.elements, appState, files };
}

/** Replace the body only; retain the original fence, indentation and line endings. */
export function replaceExcalidrawFence(fence: string, scene: string): string {
  const opening = /^([ \t]*)(`{3,}|~{3,})excalidraw[^\r\n]*(\r\n|\n|\r)/i.exec(fence);
  if (!opening) throw new Error('O bloco Excalidraw mudou. Reabra o desenho para editar.');
  const ending = new RegExp(`(?:\\r\\n|\\n|\\r)${opening[1]}${opening[2][0]}{${opening[2].length},}[ \\t]*(?:\\r\\n|\\n|\\r)?$`).exec(fence);
  if (!ending) throw new Error('O bloco Excalidraw precisa de uma cerca de fechamento.');
  const newline = opening[3];
  return fence.slice(0, opening[0].length) + scene.replace(/\r\n?/g, '\n').replace(/\n/g, newline) + fence.slice(ending.index);
}
