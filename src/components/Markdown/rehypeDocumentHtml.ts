import { defaultSchema } from 'rehype-sanitize';
import type { Root, Element } from 'hast';
import type { VFile } from 'vfile';

/** Permit static SVG geometry, never scripts, animation, foreign HTML or remote SVG resources. */
const svgTags = ['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath'];
const svgAttributes = ['viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fillOpacity', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'strokeDasharray', 'strokeOpacity', 'opacity', 'transform', 'offset', 'stopColor', 'stopOpacity', 'gradientTransform', 'gradientUnits', 'textAnchor', 'fontSize'];
export const documentHtmlSchema = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames!, ...svgTags],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...defaultSchema.attributes!['*'], 'style', 'ariaLabel', 'ariaHidden', 'role'],
    section: [...(defaultSchema.attributes?.section || []), 'dataHeadingId', 'dataHeadingLevel', 'data-heading-id', 'data-heading-level'],
    code: [...(defaultSchema.attributes?.code || []).filter(attribute => !(Array.isArray(attribute) && attribute[0] === 'className')), 'dataDiagramOrdinal', 'data-diagram-ordinal', ['className', /^language-./, 'math-inline', 'math-display']],
    i: ['dataLucide', 'style', 'ariaLabel'],
    ...Object.fromEntries(svgTags.map(tag => [tag, svgAttributes])),
  },
};

/** Restrict inline CSS to local presentation; reject URLs, overlays and resource-loading expressions. */
export function rehypeDocumentStyles() {
  const allowed = /^(?:display|flex(?:-wrap|-direction|-grow|-shrink|-basis)?|gap|align-items|justify-content|grid-template-columns|text-align|vertical-align|color|background(?:-color)?|border(?:-radius|-width|-style|-color)?|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|font-(?:size|weight|style|family)|line-height|width|height|min-width|max-width)$/;
  return (tree: Root) => {
    function visit(node: Root | Element) {
      if (node.type === 'element') {
        const style = node.properties.style;
        if (typeof style === 'string') node.properties.style = style.split(';').filter(declaration => {
          const colon = declaration.indexOf(':');
          return colon > 0 && allowed.test(declaration.slice(0, colon).trim().toLowerCase()) && !/url\s*\(|expression|@|\\|\/\*/i.test(declaration.slice(colon + 1));
        }).join(';');
        for (const key of ['fill', 'stroke']) {
          if (typeof node.properties[key] === 'string' && /url\s*\(/i.test(node.properties[key] as string)) delete node.properties[key];
        }
      }
      for (const child of node.children) if (child.type === 'element') visit(child);
    }
    visit(tree);
  };
}

/** Remember parser-generated anchors before raw HTML is expanded. */
export function rehypeRememberAnchors() {
  return (tree: Root, file: VFile) => {
    const ids: string[] = [];
    function visit(node: Root | Element) {
      if (node.type === 'element' && typeof node.properties.id === 'string') ids.push(node.properties.id);
      for (const child of node.children) if (child.type === 'element') visit(child);
    }
    visit(tree); file.data.documentAnchors = ids;
  };
}

/** Keep outline/footnote links stable while raw HTML IDs retain the sanitizer's prefix. */
export function rehypeRestoreAnchors() {
  return (tree: Root, file: VFile) => {
    const ids = new Set(file.data.documentAnchors as string[]);
    function visit(node: Root | Element) {
      if (node.type === 'element' && typeof node.properties.id === 'string') {
        const original = node.properties.id.slice('user-content-'.length);
        if (ids.has(original)) node.properties.id = original;
      }
      for (const child of node.children) if (child.type === 'element') visit(child);
    }
    visit(tree);
  };
}
