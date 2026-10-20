/** A leading drawing fence gets a human preview even when the filesystem reads only its first 8 KiB. */
export function whiteboardPreview(value) {
  const content = value.replace(/^\uFEFF/, '').replace(/^\s*(?:<!--[\s\S]*?-->\s*)*/, '');
  return /^(?:`{3,}|~{3,})excalidraw(?:[\t ][^\r\n]*)?(?:\r\n|\r|\n|$)/i.test(content) ? 'Whiteboard · quadro editável' : undefined;
}
