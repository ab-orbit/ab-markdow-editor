import { useEffect, useState } from 'react';
import styles from './MarkdownWorkbench.module.css';
/** Shiki generates escaped markup from source; user HTML is never inserted directly. */
export function CodeHighlight({ source, language }: { source: string; language: string }) {
  const [result, setResult] = useState<{ source: string; language: string; html: string }>();
  useEffect(() => {
    let active = true;
    void import('@/lib/markdown/codeHighlight').then(module => module.highlightCode(source, language)).then(html => { if (active && html) setResult({ source, language, html }); }).catch(() => {});
    return () => { active = false; };
  }, [source, language]);
  return <div className={styles.highlightedCode} data-code-language={language}>{result?.source === source && result.language === language ? <div dangerouslySetInnerHTML={{ __html: result.html }}/> : <pre><code>{source}</code></pre>}</div>;
}
