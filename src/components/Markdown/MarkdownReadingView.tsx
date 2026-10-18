import ReactMarkdown from 'react-markdown';
import { Children, cloneElement, isValidElement, type InputHTMLAttributes, type MouseEvent, type KeyboardEvent } from 'react';
import remarkGfm from 'remark-gfm';
import { remarkMissingFootnotes } from './remarkMissingFootnotes';
import styles from './MarkdownWorkbench.module.css';
import { resolveAsset, type MarkdownAsset } from '@/lib/markdown/assets';
import type { SourceRange } from './editorCommands';

/** Render registered local image URLs; unregistered URLs remain textual references. */
function DocumentImage({ source, alt, assets }: { source?: string; alt?: string; assets: readonly MarkdownAsset[] }) {
  const asset = source ? resolveAsset(source, assets) : undefined;
  if (!asset) return <span className={styles.image} title="Imagem não anexada. Abra o pacote com os arquivos assets para exibi-la.">Imagem · {alt || 'sem descrição'}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- Local blob URLs are owned by this browser, not an optimization server.
  return <img className={styles.documentImage} src={asset.url} alt={alt || asset.file.name}/>;
}

interface MarkdownReadingViewProps {
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
/** Render GFM without executing embedded HTML or automatically fetching remote images. */
export function MarkdownReadingView({ value, assets = [], onEditTable, onToggleTask, onEditBlock, doubleClickToEdit = true }: MarkdownReadingViewProps) {
  function blockProps(node?: {position?: {start: {offset?: number};end: {offset?: number}}}) {
    const from=node?.position?.start.offset,to=node?.position?.end.offset;
    if(!onEditBlock||from===undefined||to===undefined)return {};
    return {
      'data-source-from':from,'data-source-to':to,tabIndex:0,
      title:doubleClickToEdit?'Dois cliques ou Enter para editar este bloco':'Enter para editar este bloco',
      onDoubleClick:(event:MouseEvent<HTMLElement>)=>{
        if(!doubleClickToEdit||event.target instanceof Element&&event.target.closest('a,button,input,select,textarea'))return;
        event.preventDefault();event.stopPropagation();onEditBlock!({from,to});
      },
      onKeyDown:(event:KeyboardEvent<HTMLElement>)=>{
        if(event.key!=='Enter'||event.target!==event.currentTarget||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
        event.preventDefault();event.stopPropagation();onEditBlock!({from,to});
      },
    };
  }
  return <article className={styles.reading} aria-label="Prévia Markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMissingFootnotes]} remarkRehypeOptions={{ footnoteLabel: 'Referências', footnoteBackLabel: 'Voltar à referência' }} skipHtml components={{
      h1:({node,...props})=><h1 {...props} {...blockProps(node)}/>,
      h2:({node,...props})=><h2 {...props} {...blockProps(node)}/>,
      h3:({node,...props})=><h3 {...props} {...blockProps(node)}/>,
      h4:({node,...props})=><h4 {...props} {...blockProps(node)}/>,
      h5:({node,...props})=><h5 {...props} {...blockProps(node)}/>,
      h6:({node,...props})=><h6 {...props} {...blockProps(node)}/>,
      p:({node,...props})=><p {...props} {...blockProps(node)}/>,
      pre:({node,...props})=><pre {...props} {...blockProps(node)}/>,
      hr:({node,...props})=><hr {...props} {...blockProps(node)}/>,
      a: ({ node, ...props }) => {
        void node;
        // Footnotes require the generated id/data attributes and same-document navigation.
        return props.href?.startsWith('#') ? <a {...props}/> : <a {...props} target="_blank" rel="noopener noreferrer"/>;
      },
      img: ({ alt, src }) => <DocumentImage source={typeof src === 'string' ? src : undefined} alt={alt} assets={assets}/>,
      li: ({ children, node, ...props }) => <li {...props} {...blockProps(node)}>{Children.map(children, child => isValidElement<InputHTMLAttributes<HTMLInputElement>>(child) && child.type === 'input' && node?.position?.start.offset !== undefined ? cloneElement(child, { disabled: !onToggleTask, 'aria-label': 'Alternar tarefa', onChange: () => onToggleTask?.({ from: node.position!.start.offset!, to: node.position!.end.offset! }) }) : child)}</li>,
      table: ({ children, node }) => <div className={styles.table} {...blockProps(node)}>{onEditTable && node?.position?.start.offset !== undefined && node?.position?.end.offset !== undefined && <button className={styles.editTable} type="button" onClick={() => onEditTable({ from: node.position!.start.offset!, to: node.position!.end.offset! })}>Editar tabela</button>}<table>{children}</table></div>,
    }}>{value}</ReactMarkdown>
  </article>;
}
