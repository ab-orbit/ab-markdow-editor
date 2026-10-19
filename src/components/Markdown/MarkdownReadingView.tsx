import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import { Children, cloneElement, createContext, createElement, isValidElement, useContext, type HTMLAttributes, type InputHTMLAttributes, type MouseEvent, type KeyboardEvent } from 'react';
import remarkGfm from 'remark-gfm';
import { remarkMissingFootnotes } from './remarkMissingFootnotes';
import { remarkHeadingIds } from './remarkHeadingIds';
import { remarkDiagramIds } from './remarkDiagramIds';
import { diagramIdentity, diagramLanguage } from '@/lib/markdown/diagrams';
import styles from './MarkdownWorkbench.module.css';
import { resolveAsset, type MarkdownAsset } from '@/lib/markdown/assets';
import type { SourceRange } from './editorCommands';
import { DiagramBlock } from './DiagramBlock';

interface MarkdownReadingViewProps {
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
  /** Disable only the gesture, preserving the keyboard alternative. */
  doubleClickToEdit?: boolean;
}
interface ReadingContextValue extends Omit<MarkdownReadingViewProps, 'value'> { assets: readonly MarkdownAsset[] }
const context = createContext<ReadingContextValue>({ assets: [] });

type PositionedNode = { position?: { start: { offset?: number }; end: { offset?: number } } };
function blockProps(node: PositionedNode | undefined, { onEditBlock, doubleClickToEdit = true }: ReadingContextValue) {
  const from = node?.position?.start.offset, to = node?.position?.end.offset;
  if (!onEditBlock || from === undefined || to === undefined) return {};
  return {
    'data-source-from': from, 'data-source-to': to, tabIndex: 0,
    title: doubleClickToEdit ? 'Dois cliques ou Enter para editar este bloco' : 'Enter para editar este bloco',
    onDoubleClick: (event: MouseEvent<HTMLElement>) => {
      if (!doubleClickToEdit || event.target instanceof Element && event.target.closest('a,button,input,select,textarea')) return;
      event.preventDefault(); event.stopPropagation(); onEditBlock({ from, to });
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' || event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault(); event.stopPropagation(); onEditBlock({ from, to });
    },
  };
}

/** Component identities stay stable when the host refreshes status or preferences. */
function sourceBlock(tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'hr') {
  return function SourceBlock({ node, ...props }: HTMLAttributes<HTMLElement> & ExtraProps) {
    return createElement(tag, { ...props, ...blockProps(node, useContext(context)) });
  };
}
const components: Components = {
  h1: sourceBlock('h1'), h2: sourceBlock('h2'), h3: sourceBlock('h3'),
  h4: sourceBlock('h4'), h5: sourceBlock('h5'), h6: sourceBlock('h6'),
  p: sourceBlock('p'), hr: sourceBlock('hr'),
  pre: function ReadingCode({ node, ...props }) {
    const settings = useContext(context);
    const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code');
    const classes = code?.type === 'element' ? code.properties.className : undefined;
    const language = Array.isArray(classes) ? classes.map(name => diagramLanguage(String(name).replace(/^language-/i, ''))).find(Boolean) : undefined;
    if (code?.type === 'element' && language) {
      const source = code.children.map(child => child.type === 'text' ? child.value : '').join('');
      const from = node?.position?.start.offset, to = node?.position?.end.offset;
      const occurrence = Number(code.properties['data-diagram-ordinal'] ?? code.properties.dataDiagramOrdinal ?? 0);
      return <div {...blockProps(node, settings)}><DiagramBlock source={source} language={language} identity={diagramIdentity(settings.diagramScope || 'document', source, occurrence, language)} legacyIdentity={`${settings.diagramScope}:${from}`} onEdit={settings.onEditBlock && from !== undefined && to !== undefined ? () => settings.onEditBlock!({ from, to }) : undefined}/></div>;
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
    if (!asset) return <span className={styles.image} title="Imagem não anexada. Abra o pacote com os arquivos assets para exibi-la.">Imagem · {alt || 'sem descrição'}</span>;
    return <img className={styles.documentImage} src={asset.url} alt={alt || asset.file.name}/>;
  },
  li: function ReadingListItem({ children, node, ...props }) {
    const settings = useContext(context);
    return <li {...props} {...blockProps(node, settings)}>{Children.map(children, child => isValidElement<InputHTMLAttributes<HTMLInputElement>>(child) && child.type === 'input' && node?.position?.start.offset !== undefined ? cloneElement(child, {
      disabled: !settings.onToggleTask, 'aria-label': 'Alternar tarefa',
      onChange: () => settings.onToggleTask?.({ from: node.position!.start.offset!, to: node.position!.end.offset! }),
    }) : child)}</li>;
  },
  table: function ReadingTable({ children, node }) {
    const settings = useContext(context);
    return <div className={styles.readingTable} {...blockProps(node, settings)}>{settings.onEditTable && node?.position?.start.offset !== undefined && node?.position?.end.offset !== undefined && <button className={styles.editTable} type="button" onClick={() => settings.onEditTable!({ from: node.position!.start.offset!, to: node.position!.end.offset! })}>Editar tabela</button>}<div className={styles.tableScroll} role="region" aria-label="Tabela com rolagem horizontal" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.currentTarget.scrollBy({ left: event.key === 'ArrowLeft' ? -100 : 100 }); } }}><table>{children}</table></div></div>;
  },
};

/** Render GFM with stable source-backed blocks and isolated diagram components. */
export function MarkdownReadingView({ value, assets = [], diagramScope = 'document', ...settings }: MarkdownReadingViewProps) {
  return <context.Provider value={{ ...settings, assets, diagramScope }}><article className={styles.reading} aria-label="Prévia Markdown" lang="pt-BR">
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMissingFootnotes, remarkHeadingIds, remarkDiagramIds]} remarkRehypeOptions={{ footnoteLabel: 'Referências', footnoteBackLabel: 'Voltar à referência' }} skipHtml components={components}>{value}</ReactMarkdown>
  </article></context.Provider>;
}
