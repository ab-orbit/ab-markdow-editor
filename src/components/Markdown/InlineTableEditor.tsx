import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkCompatibleMath, mathOptions } from '@/lib/markdown/math';
import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseEditableTable, serializeTable } from '@/lib/markdown/tables';
import styles from './MarkdownWorkbench.module.css';
/** Edit cell content without exposing table pipes or alignment delimiters. */
export function InlineTableEditor({ source, row, column, onChange, onFinish }: { source: string; row: number; column: number; onChange: (source: string) => void; onFinish: () => void }) {
  const [table, setTable] = useState(() => parseEditableTable(source, false));
  const [cell, setCell] = useState({ row, column });
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), tableRef = useRef(table), changed = useRef(false), callbacks = useRef({ onChange, onFinish });
  callbacks.current = { onChange, onFinish }; tableRef.current = table;
  function commit() { if (changed.current) { changed.current = false; callbacks.current.onChange(serializeTable(tableRef.current)); } }
  useEffect(() => { input.current?.focus(); }, [cell]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { commit(); callbacks.current.onFinish(); } };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, []);
  return <div ref={root} className={styles.tableScroll} data-inline-table-editor><table><tbody>{table.rows.map((cells, ri) => <tr key={ri}>{cells.map((value, ci) => {
    const Tag = ri === 0 ? 'th' : 'td';
    return <Tag key={ci} style={{ textAlign: table.alignments[ci] }} onDoubleClick={() => { commit(); setCell({ row: ri, column: ci }); }}>{cell.row === ri && cell.column === ci ? <input ref={input} aria-label={t("Linha {0}, coluna {1}", ri + 1, ci + 1)} value={value} onChange={event => {
        const next = { ...table, rows: table.rows.map((row, index) => index === ri ? row.map((text, index) => index === ci ? event.target.value : text) : row) };
        tableRef.current = next; changed.current = true; setTable(next);
      }} onBlur={commit} onKeyDown={event => {
        if (event.key === 'Escape' || event.key === 'Enter') { event.preventDefault(); commit(); onFinish(); }
        if (event.key === 'Tab') {
          const total = table.rows.length * cells.length, current = ri * cells.length + ci;
          const next = current + (event.shiftKey ? -1 : 1);
          commit();
          if (next >= 0 && next < total) { event.preventDefault(); setCell({ row: Math.floor(next / cells.length), column: next % cells.length }); }
          else onFinish();
        }
      }}/> : <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkCompatibleMath]} rehypePlugins={[[rehypeKatex, mathOptions]]} components={{ p: ({ children }) => <span>{children}</span> }}>{value}</ReactMarkdown>}</Tag>;
  })}</tr>)}</tbody></table></div>;
}
