/** Append a versioned reference section while preserving every existing source byte. */
export function extendDiagramManual(value, bundled, extensions = ['zenuml-v1', 'excalidraw-v1']) {
  if (!value.includes('<!-- scriba-reference:diagram-manual version=')) return null;
  const newline = value.includes('\r\n') ? '\r\n' : '\n';
  let next = value;
  for (const extension of extensions) {
    const start = `<!-- scriba-extension:${extension}:start -->`, end = `<!-- scriba-extension:${extension}:end -->`;
    if (next.includes(start)) continue;
    const from = bundled.indexOf(start), to = bundled.indexOf(end, from);
    if (from < 0 || to < 0) throw new Error(`The bundled ${extension} reference section is missing.`);
    const section = bundled.slice(from, to + end.length).replace(/\r\n?/g, '\n').replace(/\n/g, newline);
    next += newline + newline + section + newline;
  }
  return next === value ? null : next;
}
