import { t } from '../../i18n';
import { strToU8, unzipSync, zipSync } from 'fflate';

export interface MarkdownAsset {
  /** Stable relative source path, never a temporary blob URL. */
  path: string;
  /** Original raster image bytes and filename. */
  file: File;
  /** Session-only URL owned and released by the workbench. */
  url: string;
}
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGES_TOTAL_BYTES = 40 * 1024 * 1024;
export const MAX_ASSETS = 50;

/** Accept raster formats by signature rather than trusting the extension or MIME. */
export function imageType(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((byte, i) => bytes[i] === byte)) return { mime: 'image/png', extension: 'png' };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: 'image/jpeg', extension: 'jpg' };
  const head = String.fromCharCode(...bytes.slice(0, 12));
  if (/^GIF8[79]a/.test(head)) return { mime: 'image/gif', extension: 'gif' };
  if (head.startsWith('RIFF') && head.slice(8,12) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
}

export async function prepareImages(files: File[], existing: readonly MarkdownAsset[]): Promise<{ path: string; file: File }[]> {
  if (existing.length + files.length > MAX_ASSETS) throw new Error(t("O documento aceita até 50 imagens."));
  if (existing.reduce((sum, asset) => sum + asset.file.size, 0) + files.reduce((sum, file) => sum + file.size, 0) > MAX_IMAGES_TOTAL_BYTES) throw new Error(t("As imagens excedem o limite total de 40 MB."));
  return Promise.all(files.map(async file => {
    if (file.size > MAX_ASSET_BYTES) throw new Error(t("Cada imagem pode ter até 10 MB."));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type) throw new Error(t("Use imagens PNG, JPEG, GIF ou WebP."));
    const stem = file.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'imagem';
    return { path: `assets/${crypto.randomUUID()}-${stem}.${type.extension}`, file: new File([bytes], file.name, { type: type.mime }) };
  }));
}

/** Resolve only registered paths; source Markdown never receives blob URLs. */
export function resolveAsset(source: string, assets: readonly MarkdownAsset[]): MarkdownAsset | undefined {
  let path: string;
  try { path = decodeURIComponent(source).replace(/^\.\//, ''); } catch { return undefined; }
  return assets.find(asset => asset.path === path);
}

export async function createMarkdownPackage(value: string, assets: readonly MarkdownAsset[]): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {
    'text.md': strToU8(value),
    'info.json': strToU8(JSON.stringify({ version: 2, type: 'net.daringfireball.markdown', creatorIdentifier: 'ab-polinsights' }, null, 2)),
  };
  for (const asset of assets) files[asset.path] = new Uint8Array(await asset.file.arrayBuffer());
  const archive = zipSync(files, { level: 0 });
  if (archive.byteLength > MAX_PACKAGE_BYTES) throw new Error(t("O pacote excede o limite de 50 MB."));
  return archive;
}

/** Read our ZIP or one TextBundle inside a .bear/.zip without extracting to disk. */
export async function readMarkdownPackage(file: File): Promise<{ value: string; files: { path: string; file: File }[] }> {
  if (file.size > MAX_PACKAGE_BYTES) throw new Error(t("O pacote excede o limite de 50 MB."));
  let total = 0; let count = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
    if (++count > 200 || (total += entry.originalSize) > MAX_PACKAGE_BYTES) throw new Error(t("O conteúdo do pacote excede os limites de importação."));
    if (entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').some(part => part === '..')) throw new Error(t("O pacote contém um caminho inválido."));
    return !entry.name.endsWith('/');
  } });
  const documents = Object.keys(files).filter(name => /(?:^|\/)text\.md$/.test(name));
  if (documents.length !== 1) throw new Error(t("O pacote deve conter um único text.md."));
  const name = documents[0]; const prefix = name.slice(0, -'text.md'.length);
  if (files[name].length > 5 * 1024 * 1024) throw new Error(t("O Markdown excede o limite de 5 MB."));
  const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(files[name]);
  const assets = Object.entries(files).filter(([path]) => path.startsWith(`${prefix}assets/`)).map(([path, bytes]) => {
    const type = imageType(bytes);
    if (!type || bytes.length > MAX_ASSET_BYTES) throw new Error(t("O pacote contém uma imagem inválida ou maior que 10 MB."));
    return { path: path.slice(prefix.length), file: new File([Uint8Array.from(bytes)], path.split('/').at(-1)!, { type: type.mime }) };
  });
  if (assets.length > MAX_ASSETS) throw new Error(t("O pacote excede o limite de 50 imagens."));
  return { value, files: assets };
}
