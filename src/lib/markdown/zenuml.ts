import { t } from '../../i18n';
import { ensureDiagramFontsLoaded, ensureDiagramIconsLoaded, getDiagramFontFaceCss, renderToSvg, setDiagramFontUrl } from '@zenuml/core';
import { validate } from '@zenuml/core/parser';
import { scopeDiagramSvg } from './diagrams';
import plexUrl from '@zenuml/core/fonts/IBMPlexSans-Regular-Latin1.woff2?url';

// Public CSP permits same-origin fonts. Vite emits and precaches this file;
// using the embedded data: face would silently fall back to different metrics.
setDiagramFontUrl(plexUrl);

/** Keep the official layout/font metrics and local vector icons, without its HTML UI. */
export async function renderZenUml(source: string): Promise<string> {
  const code = source.replace(/^\s*zenuml\s*(?:\n|$)/i, '');
  if (!code.trim()) throw new Error(t("Adicione participantes e mensagens ao bloco ZenUML."));
  const parsed = validate(code);
  if (!parsed.pass) {
    const error = parsed.errorDetails[0];
    throw new Error(error ? `ZenUML · linha ${error.line}, coluna ${error.column + 1}: ${error.msg}` : t("Confira a sintaxe ZenUML."));
  }
  await Promise.all([ensureDiagramFontsLoaded(), ensureDiagramIconsLoaded(code)]);
  const result = renderToSvg(code, { theme: 'theme-default', enableNumbering: true });
  if (!(result.width > 0 && result.height > 0)) throw new Error(t("O bloco não contém um diagrama ZenUML válido."));
  const template = document.createElement('template'); template.innerHTML = result.svg;
  const root = template.content.querySelector('svg')!;
  // A repeated cloud icon can bring repeated gradient/path IDs from the
  // vendor SVG. Isolate each icon before the whole drawing is namespaced.
  root.querySelectorAll('.participant-icon').forEach((icon, index) => {
    const isolated = document.createElement('template');
    isolated.innerHTML = scopeDiagramSvg(`<svg>${icon.outerHTML}</svg>`, `zen-icon-${index}`);
    icon.replaceWith(isolated.content.querySelector('svg')!.firstElementChild!);
  });
  // Load the official font once through FontFace. The shared SVG sanitizer
  // deliberately forbids resource URLs, including duplicated font rules.
  for (const style of root.querySelectorAll('style')) style.textContent = (style.textContent || '').replace(/@font-face\s*\{[^}]*\}/g, '');
  for (const label of root.querySelectorAll<SVGElement>('.stereotype-label')) label.style.removeProperty('fill');
  const theme = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  // Both themes use Scriba tokens. Explicit participant colors and the
  // library's vector brand icons remain authored diagram data.
  theme.textContent = `
    .frame-border-outer, .frame-border-inner { fill: none; }
    .frame-header-line { stroke: var(--border-base); }
    .frame-title, .participant-label, .stereotype-label, .message-label, .return-label,
    .fragment-label, .fragment-condition, .fragment-section-label,
    .group-title-text { fill: var(--text-primary); }
    .participant-box, .occurrence, .fragment-header, .group-title-bg,
    .divider-bg { fill: var(--bg-elevated); }
    .participant-box, .occurrence, .fragment-border, .fragment-separator,
    .group-outline, .lifeline, .divider-bg, .divider-line,
    .message-line, .return-line, .return-arrow { stroke: var(--text-muted); }
    .stereotype-label { font-family: "IBM Plex Sans", Helvetica, Verdana, sans-serif; }
    .participant-icon { color: var(--text-primary); }
    .participant-icon [fill="currentColor"]:not([stroke]) { stroke: var(--text-muted); }
    .arrow-head { fill: var(--text-muted); stroke: var(--text-muted); }
    .arrow-open { fill: none; }
    .return-icon { fill: var(--text-primary); }
    .comment-text { fill: var(--text-secondary); opacity: 1; }
    .seq-number, .guard-keyword, .divider-label { fill: var(--text-secondary); }
    .message-number-bg, .fragment-number-bg { fill: var(--text-muted); }
  `;
  root.append(theme);
  return root.outerHTML;
}

/** Only the pinned library's embedded local typeface is added to portable exports. */
export async function zenUmlExportFont(): Promise<string> { return await getDiagramFontFaceCss() || ''; }
