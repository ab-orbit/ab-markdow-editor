import type { Root, RootContent } from 'mdast';
import { diagramSourceKey } from '@/lib/markdown/diagrams';

/** Namespace equal diagrams by occurrence rather than their changing text offsets. */
export function remarkDiagramIds() {
  return (tree: Root) => {
    const occurrences = new Map<string, number>();
    function visit(node: Root | RootContent): void {
      if (node.type === 'code' && node.lang?.toLowerCase() === 'mermaid') {
        const key = diagramSourceKey(node.value), ordinal = occurrences.get(key) || 0;
        occurrences.set(key, ordinal + 1);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, 'data-diagram-ordinal': ordinal } };
      }
      if ('children' in node) node.children.forEach(child => visit(child as RootContent));
    }
    visit(tree);
  };
}
