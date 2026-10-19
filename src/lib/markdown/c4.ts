import type { MermaidConfig } from 'mermaid';
import type { DiagramAppearance } from './diagrams';

/** C4 has its own typography and hard-coded paints outside Mermaid's theme. */
export function isC4(source: string) {
  return /^\s*C4(?:Context|Container|Component|Dynamic|Deployment)\b/m.test(source);
}

export interface C4ElementStyle {
  alias: string;
  /** Author-specified paints take precedence over the application defaults. */
  fontColor?: string;
  bgColor?: string;
}
export interface C4RelationStyle { offsetX?: number; offsetY?: number; textColor?: string; lineColor?: string }

/** C4's legacy renderer offsets labels by half their own width. Recenter them
 * on the connection and keep automatic positions clear of node text. */
function positionLabels(root: SVGSVGElement, relations: C4RelationStyle[]) {
  const inverse = root.getScreenCTM()?.inverse();
  if (!inverse) return;
  const box = (node: SVGGraphicsElement) => {
    const rect = node.getBoundingClientRect();
    const start = new DOMPoint(rect.left, rect.top).matrixTransform(inverse), end = new DOMPoint(rect.right, rect.bottom).matrixTransform(inverse);
    return { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y };
  };
  const nodes = [...root.querySelectorAll<SVGGElement>('.c4-shape')].map(box), placed: typeof nodes = [];
  const overlaps = (a: typeof nodes[number], b: typeof nodes[number]) => a.x < b.x + b.width + 6 && a.x + a.width + 6 > b.x && a.y < b.y + b.height + 6 && a.y + a.height + 6 > b.y;
  let relation = -1;
  for (const group of root.querySelectorAll<SVGGElement>(':scope > g')) {
    const children = [...group.children];
    for (let index = 0; index < children.length; index++) {
      const edge = children[index];
      if (!(edge instanceof SVGGeometryElement) || !edge.hasAttribute('marker-end') && !edge.hasAttribute('marker-start')) continue;
      const authored = relations[++relation];
      const labels: SVGTextElement[] = [];
      for (let next = index + 1; next < children.length && children[next] instanceof SVGTextElement; next++) labels.push(children[next] as SVGTextElement);
      if (authored?.lineColor) edge.setAttribute('stroke', authored.lineColor);
      if (authored?.textColor) labels.forEach(label => label.setAttribute('fill', authored.textColor!));
      if (authored?.offsetX || authored?.offsetY) continue;
      if (!labels.length) continue;
      const boxes = labels.map(box), x = Math.min(...boxes.map(rect => rect.x)), y = Math.min(...boxes.map(rect => rect.y));
      const width = Math.max(...boxes.map(rect => rect.x + rect.width)) - x, height = Math.max(...boxes.map(rect => rect.y + rect.height)) - y;
      const line = box(edge), center = { x: line.x + line.width / 2, y: line.y + line.height / 2 };
      const candidates = line.height > line.width
        ? [{ x: center.x + 12, y: center.y - height / 2 }, { x: center.x - width - 12, y: center.y - height / 2 }]
        : [{ x: center.x - width / 2, y: center.y - height - 10 }, { x: center.x - width / 2, y: center.y + 10 }];
      const near = nodes.filter(node => node.x < line.x + line.width + 20 && node.x + node.width > line.x - 20);
      const top = Math.min(...near.map(node => node.y), center.y), bottom = Math.max(...near.map(node => node.y + node.height), center.y);
      // Bound candidate work for large authored graphs, independently of edge count.
      for (let row = 0; row < Math.min(relations.length + 1, 8); row++) {
        candidates.push({ x: center.x - width / 2, y: top - height - 12 - row * (height + 12) });
        candidates.push({ x: center.x - width / 2, y: bottom + 12 + row * (height + 12) });
      }
      const position = candidates.find(candidate => ![...nodes, ...placed].some(obstacle => overlaps({ ...candidate, width, height }, obstacle))) ?? candidates[0];
      for (const label of labels) label.setAttribute('transform', `translate(${position.x - x}, ${position.y - y})`);
      placed.push({ ...position, width, height });
    }
  }
}

export function c4Configuration(appearance: DiagramAppearance): MermaidConfig['c4'] {
  const elements = ['person', 'system', 'system_db', 'system_queue', 'container', 'container_db', 'container_queue', 'component', 'component_db', 'component_queue'].flatMap(type => [type, `external_${type}`]);
  const typography: Record<string, string | number> = {};
  for (const type of [...elements, 'boundary', 'message']) {
    typography[`${type}FontFamily`] = appearance.font;
    typography[`${type}FontSize`] = type === 'message' || type === 'boundary' ? 14 : 16;
  }
  for (const type of elements) {
    typography[`${type}_bg_color`] = appearance.surface;
    typography[`${type}_border_color`] = type.startsWith('external_') ? appearance.border : appearance.accent;
  }
  return {
    ...typography, diagramMarginX: 16, diagramMarginY: 10,
    c4ShapeMargin: 36, c4ShapePadding: 16, width: 184, wrap: true,
  };
}

/** Adapt only C4 defaults, then fit the SVG to its actual painted content. */
export function presentC4(root: SVGSVGElement, host: HTMLElement, appearance: DiagramAppearance, elements: C4ElementStyle[], relations: C4RelationStyle[]) {
  host.append(root);
  try {
    for (const shape of elements) {
      const node = root.querySelector<SVGGElement>(`[id="${CSS.escape(root.id + '-' + shape.alias)}"]`);
      // Mermaid gives unstyled labels white text, including on light surfaces.
      // Explicit colors or backgrounds retain their original author styling.
      if (node && !shape.fontColor && !shape.bgColor) {
        node.style.color = appearance.foreground;
        node.querySelectorAll<SVGElement>('.label, .label text').forEach(label => {
          label.style.color = appearance.foreground; label.style.fill = appearance.foreground;
        });
      }
    }
    // These fallback attributes are emitted by C4 regardless of themeVariables.
    // Leave other paints from UpdateElementStyle/UpdateRelStyle untouched.
    root.querySelectorAll<SVGElement>('[fill="#444444"]').forEach(node => node.setAttribute('fill', appearance.foreground));
    root.querySelectorAll<SVGElement>('[stroke="#444444"]').forEach(node => node.setAttribute('stroke', appearance.muted));
    root.querySelectorAll<SVGElement>('marker path').forEach(node => node.setAttribute('fill', appearance.muted));
    for (const node of root.querySelectorAll<SVGTextElement>(':scope > g > text')) {
      if (node.closest('.c4-shape')) continue;
      // A narrow halo separates connection labels from the line behind them.
      node.style.paintOrder = 'stroke'; node.style.stroke = appearance.background;
      node.style.strokeWidth = '4px'; node.style.strokeLinejoin = 'round';
    }
    positionLabels(root, relations);
    const title = root.querySelector<SVGTextElement>(':scope > text');
    if (title) {
      title.remove();
      const content = root.getBBox();
      title.setAttribute('x', String(content.x + content.width / 2));
      title.setAttribute('y', String(content.y - 24));
      title.setAttribute('text-anchor', 'middle');
      title.style.fontFamily = appearance.font; title.style.fontSize = '18px';
      title.style.fontWeight = '600'; title.style.fill = appearance.foreground;
      root.append(title);
    }
    const bounds = root.getBBox(), padding = 16;
    if (bounds.width > 0 && bounds.height > 0) {
      root.setAttribute('viewBox', `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`);
      root.setAttribute('height', String(bounds.height + padding * 2));
    }
  } finally { root.remove(); }
}
