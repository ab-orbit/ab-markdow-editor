import { t } from '../../i18n';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyDiagramSource } from '@/lib/markdown/diagramExport';
import styles from './DiagramBlock.module.css';
import type { DiagramLanguage } from '@/lib/markdown/diagrams';

/** Syntax highlighting is lazy; the escaped source remains readable if loading fails. */
export function DiagramSource({ source, language = 'mermaid', id, onLayout }: { source: string; language?: DiagramLanguage; id: string; onLayout?: () => void }) {
  const [markup, setMarkup] = useState<{ source: string; html: string } | null>(null);
  const [copied, setCopied] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void import('@/lib/markdown/diagramHighlight').then(module => module.highlightDiagram(source, language)).then(html => { if (!cancelled) { setMarkup({ source, html }); onLayout?.(); } }).catch(() => { /* Keep the escaped plain source and copy action available offline. */ });
    return () => { cancelled = true; };
  }, [source, language]);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  const name = language === 'excalidraw' ? t("Excalidraw") : language === 'zenuml' ? t("ZenUML") : 'Mermaid';
  const type = language === 'excalidraw' ? t("CENA JSON") : language === 'zenuml' ? t("SEQUÊNCIA") : source.trimStart().split(/\s+/)[0].replace(/(?:Diagram|-beta|-v2)$/i, "").toUpperCase() || 'MERMAID';
  return <section id={id} className={styles.codePanel} aria-label={t("Código {0}", name)} onDoubleClick={event => event.stopPropagation()}><header><span>{type}</span><span>{name}</span></header><div className={styles.highlight} role="region" aria-label={t("Código do diagrama")} tabIndex={0}>{markup?.source === source ? <div dangerouslySetInnerHTML={{ __html: markup.html }}/> : <pre><code>{source}</code></pre>}</div><footer><span role="status" aria-live="polite">{copied ? t("Código copiado") : error}</span><button type="button" aria-label={copied ? t("Código copiado") : t("Copiar código do diagrama")} title={t("Copiar código do diagrama")} onClick={() => { setError(""); void copyDiagramSource(source).then(() => setCopied(true)).catch(cause => setError(cause instanceof Error ? t(cause.message) : t("Não foi possível copiar."))); }}>{copied ? <Check size={16}/> : <Copy size={16}/>}<span>{copied ? t("Copiado") : t("Copiar")}</span></button></footer></section>;
}
