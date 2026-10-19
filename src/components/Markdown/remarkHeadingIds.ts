import type { Root } from 'mdast';
import { assignHeadingIds } from '@/lib/markdown/outline';

/** Stable Unicode anchors let reference notes navigate without leaving the editor. */
export function remarkHeadingIds() {
  return (tree: Root) => { assignHeadingIds(tree); };
}
