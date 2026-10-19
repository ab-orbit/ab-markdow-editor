/** Append a versioned reference section while preserving every existing source byte. */
export function extendDiagramManual(value, bundled) {
  const start = '<!-- scriba-extension:zenuml-v1:start -->';
  const end = '<!-- scriba-extension:zenuml-v1:end -->';
  if (!value.includes('<!-- scriba-reference:diagram-manual version=') || value.includes(start)) return null;
  const from = bundled.indexOf(start), to = bundled.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error('The bundled ZenUML reference section is missing.');
  const newline = value.includes('\r\n') ? '\r\n' : '\n';
  const section = bundled.slice(from, to + end.length).replace(/\r\n?/g, '\n').replace(/\n/g, newline);
  return value + newline + newline + section + newline;
}
