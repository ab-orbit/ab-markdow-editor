export const MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;

/** Decode a local Markdown file strictly, preserving its decoded source. */
export async function readMarkdownFile(file: File): Promise<string> {
  if (!/\.(md|markdown|mdown)$/i.test(file.name)) throw new Error('Selecione um arquivo .md, .markdown ou .mdown.');
  if (file.size > MAX_MARKDOWN_BYTES) throw new Error('O arquivo excede o limite de 5 MB.');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error('Não foi possível ler o arquivo. Verifique se está em UTF-8.');
  }
}

/** Download the current source without overwriting the original local file. */
export function downloadMarkdown(value: string, fileName: string): void {
  downloadBlob(new Blob([value], { type: 'text/markdown;charset=utf-8' }), /\.(md|markdown|mdown)$/i.test(fileName) ? fileName : `${fileName}.md`);
}

/** Trigger a browser download and release its URL after the download starts. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
