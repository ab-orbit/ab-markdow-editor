/** Recognize only the converter's explicit response envelope, never arbitrary JSON notes. */
export function extractedConversionMarkdown(source: string): string | null {
  if (!/^\uFEFF?\s*\{/.test(source) || !source.includes('"cleaned_text"') || !source.includes('"convert_to_markdown"')) return null;
  try {
    const result = JSON.parse(source.replace(/^\uFEFF/, ''));
    return result?.metadata?.function === 'convert_to_markdown' && result?.data?.success === true
      && ['file', 'url'].includes(result.data.source) && typeof result.data.cleaned_text === 'string'
      && result.data.cleaned_text.trim() ? result.data.cleaned_text : null;
  } catch { return null; }
}
/** Extracted content gets a separate destination; autosave must never replace the JSON original. */
export function conversionCopyName(name: string, existing: readonly string[] = []): string {
  const stem = name.replace(/\.(?:md|markdown|mdown)$/i, ''), used = new Set(existing);
  let candidate = `${stem} (Markdown).md`;
  for (let suffix = 1; used.has(candidate); suffix++) candidate = `${stem} (Markdown) (${suffix}).md`;
  return candidate;
}
