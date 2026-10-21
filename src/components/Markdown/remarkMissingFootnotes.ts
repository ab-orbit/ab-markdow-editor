import { t } from "../../i18n";
import type { PhrasingContent, Root, RootContent } from 'mdast';

/** Annotate unresolved footnote syntax without fabricating definitions or links. */
export function remarkMissingFootnotes() {
  return (tree: Root) => {
    function annotate(parent: Root | RootContent): void {
      if (!('children' in parent) || ['code', 'inlineCode', 'link', 'linkReference', 'image', 'html'].includes(parent.type)) return;
      const children: RootContent[] = [];
      for (const child of parent.children) {
        if (child.type !== 'text') { annotate(child); children.push(child); continue; }
        let offset = 0;
        for (const match of child.value.matchAll(/\[\^([^\]\s]+)\]/gu)) {
          const index = match.index!;
          if (index > offset) children.push({ type: 'text', value: child.value.slice(offset, index) });
          const label = t("Referência {0} sem definição no arquivo", match[1]);
          children.push({
            type: 'emphasis',
            data: { hName: 'sup', hProperties: { 'data-missing-footnote': match[1], title: label, 'aria-label': label } },
            children: [{ type: 'text', value: `[${match[1]}?]` }],
          });
          offset = index + match[0].length;
        }
        if (offset < child.value.length) children.push({ ...child, value: child.value.slice(offset) });
      }
      // All replacements are valid phrasing nodes; container children otherwise keep their type.
      parent.children = children as PhrasingContent[] & RootContent[];
    }
    annotate(tree);
  };
}
