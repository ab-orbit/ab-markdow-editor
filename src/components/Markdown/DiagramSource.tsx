import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyDiagramSource } from '@/lib/markdown/diagramExport';
import styles from './DiagramBlock.module.css';

/** Syntax highlighting is lazy; the escaped source remains readable if loading fails. */
export function DiagramSource({ source, id, onLayout }: { source: string; id: string; onLayout?: () => void }) {
  const [markup, setMarkup] = useState<{ source: string; html: string } | null>(null);
  const [copied, setCopied] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void import('@/lib/markdown/diagramHighlight').then(module => module.highlightDiagram(source)).then(html => { if (!cancelled) { setMarkup({ source, html }); onLayout?.(); } }).catch(() => { /* Keep the escaped plain source and copy action available offline. */ });
    return () => { cancelled = true; };
  }, [source]);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  const type = source.trimStart().split(/\s+/)[0].replace(/(?:Diagram|-beta|-v2)$/i, '').toUpperCase() || 'MERMAID';
  return <section id={id} className={styles.codePanel} aria-label="Código Mermaid" onDoubleClick={event => event.stopPropagation()}>
    <header><span>{type}</span><span>Mermaid</span></header>
    <div className={styles.highlight} role="region" aria-label="Código do diagrama" tabIndex={0}>{markup?.source === source ? <div dangerouslySetInnerHTML={{ __html: markup.html }}/> : <pre><code>{source}</code></pre>}</div>
    <footer><span role="status" aria-live="polite">{copied ? 'Código copiado' : error}</span><button type="button" aria-label={copied ? 'Código copiado' : 'Copiar código do diagrama'} title="Copiar código do diagrama" onClick={() => { setError(''); void copyDiagramSource(source).then(() => setCopied(true)).catch(cause => setError(cause instanceof Error ? cause.message : 'Não foi possível copiar.')); }}>{copied ? <Check size={16}/> : <Copy size={16}/>}<span>{copied ? 'Copiado' : 'Copiar'}</span></button></footer>
  </section>;
}
