import ReactMarkdown from 'react-markdown';
import { Children, cloneElement, isValidElement, type InputHTMLAttributes } from 'react';
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

/** Render GFM without executing embedded HTML or automatically fetching remote images. */
export function MarkdownReadingView({ value, assets = [], onEditTable, onToggleTask }: { value: string; assets?: readonly MarkdownAsset[]; onEditTable?: (range: SourceRange) => void; onToggleTask?: (range: SourceRange) => void }) {
  return <article className={styles.reading} aria-label="Prévia Markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMissingFootnotes]} remarkRehypeOptions={{ footnoteLabel: 'Referências', footnoteBackLabel: 'Voltar à referência' }} skipHtml components={{
      a: ({ node, ...props }) => {
        void node;
        // Footnotes require the generated id/data attributes and same-document navigation.
        return props.href?.startsWith('#') ? <a {...props}/> : <a {...props} target="_blank" rel="noopener noreferrer"/>;
      },
      img: ({ alt, src }) => <DocumentImage source={typeof src === 'string' ? src : undefined} alt={alt} assets={assets}/>,
      li: ({ children, node, ...props }) => <li {...props}>{Children.map(children, child => isValidElement<InputHTMLAttributes<HTMLInputElement>>(child) && child.type === 'input' && node?.position?.start.offset !== undefined ? cloneElement(child, { disabled: !onToggleTask, 'aria-label': 'Alternar tarefa', onChange: () => onToggleTask?.({ from: node.position!.start.offset!, to: node.position!.end.offset! }) }) : child)}</li>,
      table: ({ children, node }) => <div className={styles.table}>{onEditTable && node?.position?.start.offset !== undefined && node?.position?.end.offset !== undefined && <button className={styles.editTable} type="button" onClick={() => onEditTable({ from: node.position!.start.offset!, to: node.position!.end.offset! })}>Editar tabela</button>}<table>{children}</table></div>,
    }}>{value}</ReactMarkdown>
  </article>;
}
