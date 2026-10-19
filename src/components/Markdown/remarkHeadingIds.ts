import type { Root, RootContent } from 'mdast';

/** Stable Unicode anchors let reference notes navigate without leaving the editor. */
export function remarkHeadingIds() {
  return (tree: Root) => {
    const used = new Set<string>();
    function text(node: Root | RootContent): string {
      if ('value' in node && typeof node.value === 'string') return node.value;
      return 'children' in node ? node.children.map(child => text(child as RootContent)).join('') : '';
    }
    function visit(node: Root | RootContent): void {
      if (node.type === 'heading') {
        const base = text(node).toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/gu, '-') || 'section';
        let id = base;
        for (let suffix = 1; used.has(id); suffix++) id = `${base}-${suffix}`;
        used.add(id);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      }
      if ('children' in node) node.children.forEach(child => visit(child as RootContent));
    }
    visit(tree);
  };
}
