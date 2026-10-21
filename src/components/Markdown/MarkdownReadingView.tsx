import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { remarkCompatibleMath, mathOptions } from '@/lib/markdown/math';
import { t, useLanguage } from '../../i18n';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { remarkSections } from './remarkSections';
import { InlineBlockEditor } from './InlineBlockEditor';
import { InlineTableEditor } from './InlineTableEditor';
import { CodeHighlight } from './CodeHighlight';
import type { MarkdownEditorHandle } from './MarkdownEditor';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { documentHtmlSchema, rehypeDocumentStyles, rehypeRememberAnchors, rehypeRestoreAnchors } from './rehypeDocumentHtml';
import { DocumentIcon } from './DocumentIcon';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import { Children, cloneElement, createContext, createElement, isValidElement, useContext, useState, useMemo, type RefObject, type HTMLAttributes, type InputHTMLAttributes, type MouseEvent, type KeyboardEvent } from 'react';
import remarkGfm from 'remark-gfm';
import { remarkMissingFootnotes } from './remarkMissingFootnotes';
import { remarkHeadingIds } from './remarkHeadingIds';
import { remarkDiagramIds } from './remarkDiagramIds';
import { diagramIdentity, diagramLanguage } from '@/lib/markdown/diagrams';
import styles from './MarkdownWorkbench.module.css';
import { resolveAsset, type MarkdownAsset } from '@/lib/markdown/assets';
import type { SourceRange } from './editorCommands';
import { RenderedDiagram } from './RenderedDiagram';
import type { Root, RootContent } from 'mdast';

/** remark-parse skips a leading BOM in offsets; editing must address the original string. */
function remarkOriginalOffsets() {
  return (tree: Root, file: { value: unknown }) => {
    if (!String(file.value).startsWith('\uFEFF')) return;
    function visit(node: Root | RootContent) {
      if (node.position) { if (node.position.start.offset !== undefined) node.position.start.offset++; if (node.position.end.offset !== undefined) node.position.end.offset++; }
      if ('children' in node) node.children.forEach(child => visit(child as RootContent));
    }
    visit(tree);
  };
}

interface MarkdownReadingViewProps {
  /** Presentation-only section folding shared with the outline. */
  collapsedHeadings?: ReadonlySet<string>;
  onToggleHeading?: (id: string) => void;
  /** Apply one source-backed local edit without switching the whole document. */
  onChangeBlock?: (range: SourceRange, source: string) => void;
  inlineEditorRef?: RefObject<MarkdownEditorHandle | null>;
  /** Scope diagram presentation preferences to the current document. */
  diagramScope?: string;
  /** Original source; rendered-node offsets remain UTF-16 positions in this string. */
  value: string;
  /** Registered raster assets; external images are never fetched. */
  assets?: readonly MarkdownAsset[];
  /** Open the existing source-backed table editor. */
  onEditTable?: (range: SourceRange) => void;
  /** Toggle the original task marker without serializing rendered HTML. */
  onToggleTask?: (range: SourceRange) => void;
  /** Reveal one source block; omit in read-only contexts. */
  onEditBlock?: (range: SourceRange) => void;
  /** Commit a visual scene edit into exactly this original fenced block. */
  onChangeDiagram?: (range: SourceRange, source: string) => void;
  /** Disable only the gesture, preserving the keyboard alternative. */
  doubleClickToEdit?: boolean;
}
interface ReadingContextValue extends Omit<MarkdownReadingViewProps, 'value'> {
  assets: readonly MarkdownAsset[];
  source?: string;
  active?: SourceRange & { cursor: number };
  beginBlock?: (range: SourceRange, cursor?: number) => void;
  finishBlock?: () => void;
  updateBlock?: (source: string) => void;
}
const context = createContext<ReadingContextValue>({ assets: [] });

type PositionedNode = { position?: { start: { offset?: number }; end: { offset?: number } } };
function blockProps(node: PositionedNode | undefined, settings: ReadingContextValue) {
  const { onEditBlock, doubleClickToEdit = true } = settings;
  const from = node?.position?.start.offset, to = node?.position?.end.offset;
  if (!onEditBlock || from === undefined || to === undefined) return {};
  return {
    'data-source-from': from, 'data-source-to': to, tabIndex: 0,
    title: doubleClickToEdit ? t("Dois cliques ou Enter para editar este bloco") : t("Enter para editar este bloco"),
    onDoubleClick: (event: MouseEvent<HTMLElement>) => {
      if (!doubleClickToEdit || event.target instanceof Element && event.target.closest('a,button,input,select,textarea')) return;
      event.preventDefault(); event.stopPropagation();
      const selection = window.getSelection(), text = selection?.focusNode?.textContent || "";
      const source = settings.source?.slice(from, to) || "";
      const index = text ? source.indexOf(text) : -1;
      if (settings.beginBlock) settings.beginBlock({ from, to }, index >= 0 ? index + (selection?.focusOffset || 0) : 0);
      else onEditBlock({ from, to });
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' || event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault(); event.stopPropagation(); if (settings.beginBlock) settings.beginBlock({ from, to }); else onEditBlock({ from, to });
    },
  };
}

function activeEditor(node: PositionedNode | undefined, settings: ReadingContextValue, level?: number) {
  const active = settings.active;
  if (!active || node?.position?.start.offset !== active.from) return null;
  return <InlineBlockEditor source={settings.source!.slice(active.from, active.to)} cursor={active.cursor} level={level} editorRef={settings.inlineEditorRef} onChange={settings.updateBlock!} onFinish={settings.finishBlock!}/>;
}

/** Component identities stay stable when the host refreshes status or preferences. */
function sourceBlock(tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'hr') {
  return function SourceBlock({ node, ...props }: HTMLAttributes<HTMLElement> & ExtraProps) {
    const settings = useContext(context);
    return activeEditor(node, settings, tag.startsWith('h') && tag !== 'hr' ? Number(tag.slice(1)) : undefined) || createElement(tag, { ...props, ...blockProps(node, settings) });
  };
}
const components: Components = {
  section: function ReadingSection({ node, children, ...props }) {
    const settings = useContext(context), id = node?.properties.dataHeadingId ?? node?.properties['data-heading-id'], level = Number(node?.properties.dataHeadingLevel ?? node?.properties['data-heading-level']);
    if (typeof id !== 'string' || !level || !settings.onToggleHeading) return <section {...props}>{children}</section>;
    const items = Children.toArray(children), collapsed = settings.collapsedHeadings?.has(id) || false;
    const heading = items.findIndex(child => isValidElement(child));
    const label = node?.children.find(child => child.type === 'element' && /^h[1-6]$/.test(child.tagName));
    const title = label?.type === 'element' ? label.children.map(child => child.type === 'text' ? child.value : "").join("") : id;
    return <section data-heading-section={id} data-heading-level={level}><div className={styles.sectionHeading}><button type="button" aria-label={t("{0} seção {1}", collapsed ? t("Expandir") : t("Recolher"), title || id)} aria-expanded={!collapsed} onClick={() => settings.onToggleHeading!(id)}>{collapsed ? <ChevronRight size={16}/> : <ChevronDown size={16}/>}</button>{items[heading]}</div><div hidden={collapsed}>{items.slice(heading + 1)}</div></section>;
  },
  i: function ReadingIcon({ node, children, ...props }) {
    const name = node?.properties.dataLucide;
    return typeof name === 'string' ? <DocumentIcon name={name} label={props['aria-label']} style={props.style}/> : <i {...props}>{children}</i>;
  },
  h1: sourceBlock('h1'), h2: sourceBlock('h2'), h3: sourceBlock('h3'),
  h4: sourceBlock('h4'), h5: sourceBlock('h5'), h6: sourceBlock('h6'),
  p: sourceBlock('p'), hr: sourceBlock('hr'),
  pre: function ReadingCode({ node, ...props }) {
    const settings = useContext(context);
    const active = activeEditor(node, settings);
    if (active) return active;
    const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code');
    const classes = code?.type === 'element' ? code.properties.className : undefined;
    const language = Array.isArray(classes) ? classes.map(name => diagramLanguage(String(name).replace(/^language-/i, ""))).find(Boolean) : undefined;
    if (code?.type === 'element' && language) {
      const source = code.children.map(child => child.type === 'text' ? child.value : "").join("");
      const from = node?.position?.start.offset, to = node?.position?.end.offset;
      const occurrence = Number(code.properties['data-diagram-ordinal'] ?? code.properties.dataDiagramOrdinal ?? 0);
      return <div {...blockProps(node, settings)}><RenderedDiagram source={source} language={language} identity={diagramIdentity(settings.diagramScope || 'document', source, occurrence, language)} legacyIdentity={`${settings.diagramScope}:${from}`} onChange={settings.onChangeDiagram && from !== undefined && to !== undefined ? next => settings.onChangeDiagram!({ from, to }, next) : undefined} onEdit={settings.onEditBlock && from !== undefined && to !== undefined ? () => settings.onEditBlock!({ from, to }) : undefined}/></div>;
    }
    if (code?.type === 'element') {
      const language = Array.isArray(classes) ? String(classes.find(name => String(name).startsWith('language-')) || "").replace(/^language-/, "") : "";
      const source = code.children.map(child => child.type === 'text' ? child.value : "").join("");
      return <div {...blockProps(node, settings)}><CodeHighlight source={source} language={language}/></div>;
    }
    return <pre {...props} {...blockProps(node, settings)}/>;
  },
  a: function ReadingLink({ node, ...props }) {
    void node;
    // Footnotes retain their generated IDs and same-document navigation.
    return props.href?.startsWith('#') ? <a {...props}/> : <a {...props} target="_blank" rel="noopener noreferrer"/>;
  },
  img: function ReadingImage({ alt, src }) {
    const { assets } = useContext(context);
    const asset = typeof src === 'string' ? resolveAsset(src, assets) : undefined;
    if (!asset) return <span className={styles.image} title={t("Imagem não anexada. Abra o pacote com os arquivos assets para exibi-la.")}>{t("Imagem ·")}{' '}{alt || t("sem descrição")}</span>;
    return <img className={styles.documentImage} src={asset.url} alt={alt || asset.file.name}/>;
  },
  li: function ReadingListItem({ children, node, ...props }) {
    const settings = useContext(context);
    const active = activeEditor(node, settings);
    if (active) return <li>{active}</li>;
    return <li {...props} {...blockProps(node, settings)}>{Children.map(children, child => isValidElement<InputHTMLAttributes<HTMLInputElement>>(child) && child.type === 'input' && node?.position?.start.offset !== undefined ? cloneElement(child, {
      disabled: !settings.onToggleTask, 'aria-label': t("Alternar tarefa"),
      onChange: () => settings.onToggleTask?.({ from: node.position!.start.offset!, to: node.position!.end.offset! }),
    }) : child)}</li>;
  },
  table: function ReadingTable({ children, node }) {
    const settings = useContext(context);
    const [cell, setCell] = useState<{ row: number; column: number } | null>(null);
    const from = node?.position?.start.offset, to = node?.position?.end.offset;
    if (cell && from !== undefined && to !== undefined && settings.onChangeBlock) return <div className={styles.readingTable} data-source-from={from} data-source-to={to}><InlineTableEditor source={settings.source!.slice(from, to)} row={cell.row} column={cell.column} onChange={next => settings.onChangeBlock!({ from, to }, next)} onFinish={() => setCell(null)}/></div>;
    return <div className={styles.readingTable} data-source-from={from} data-source-to={to} onDoubleClick={event => {
      event.stopPropagation();
      if (settings.doubleClickToEdit === false || !settings.onChangeBlock) return;
      const target = (event.target as Element).closest<HTMLTableCellElement>('td,th');
      if (target) { event.preventDefault(); setCell({ row: (target.parentElement as HTMLTableRowElement).rowIndex, column: target.cellIndex }); }
    }}>{settings.onEditTable && node?.position?.start.offset !== undefined && node?.position?.end.offset !== undefined && <button className={styles.editTable} type="button" onClick={() => settings.onEditTable!({ from: node.position!.start.offset!, to: node.position!.end.offset! })}>{t("Editar tabela")}</button>}<div className={styles.tableScroll} role="region" aria-label={t("Tabela com rolagem horizontal")} tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.currentTarget.scrollBy({ left: event.key === 'ArrowLeft' ? -100 : 100 }); } }}><table>{children}</table></div></div>;
  },
};

/** Render GFM with stable source-backed blocks and isolated diagram components. */
export function MarkdownReadingView({ value, assets = [], diagramScope = 'document', ...settings }: MarkdownReadingViewProps) {
  const language = useLanguage();
  const [active, setActive] = useState<(SourceRange & { cursor: number; preview: string }) | undefined>();
  const source = active?.preview ?? value;
  // Context updates still reach source-backed blocks without rerunning the Markdown pipeline.
  const rendered = useMemo(() => (<ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkCompatibleMath, remarkOriginalOffsets, remarkMissingFootnotes, remarkHeadingIds, remarkDiagramIds, remarkSections]} remarkRehypeOptions={{ footnoteLabel: t("Referências"), footnoteBackLabel: t("Voltar à referência") }} rehypePlugins={[rehypeRememberAnchors, rehypeRaw, [rehypeSanitize, documentHtmlSchema], rehypeDocumentStyles, rehypeRestoreAnchors, [rehypeKatex, mathOptions]]} components={components}>{source}</ReactMarkdown>), [source, language]);
  return <context.Provider value={{ ...settings, assets, diagramScope, source: value, active,
    beginBlock: settings.onChangeBlock ? (range, cursor = 0) => setActive({ ...range, cursor, preview: value }) : undefined,
    finishBlock: () => setActive(undefined),
    updateBlock: next => {
      if (!active) return;
      const newline = value.slice(active.from, active.to).includes('\r\n') ? '\r\n' : '\n';
      const source = next.replace(/\r?\n/g, newline);
      settings.onChangeBlock?.(active, source);
      setActive({ ...active, to: active.from + source.length });
    },
  }}><article className={styles.reading} data-large-document={value.length > 200000 || undefined} aria-label={t("Prévia Markdown")}>{rendered}</article></context.Provider>;
}
