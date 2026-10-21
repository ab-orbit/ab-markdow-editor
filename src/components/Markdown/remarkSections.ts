import type { Root, RootContent, Blockquote } from 'mdast';
/** Group top-level heading ranges without changing their source offsets or Markdown bytes. */
export function remarkSections() {
  return (tree: Root) => {
    const result: RootContent[] = [], stack: { level: number; section: Blockquote }[] = [];
    for (const node of tree.children) {
      if (node.type === 'heading') {
        while (stack.length && stack.at(-1)!.level >= node.depth) stack.pop();
        const section: Blockquote = { type: 'blockquote', children: [node], data: { hName: 'section', hProperties: { 'data-heading-id': String(node.data?.hProperties?.id || ''), 'data-heading-level': node.depth } } };
        if (stack.length) stack.at(-1)!.section.children.push(section); else result.push(section);
        stack.push({ level: node.depth, section });
      } else if (stack.length) stack.at(-1)!.section.children.push(node as Blockquote['children'][number]);
      else result.push(node);
    }
    tree.children = result;
  };
}
