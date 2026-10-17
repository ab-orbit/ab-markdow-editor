import { useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { serializeTable, type EditableTable } from '@/lib/markdown/tables';
import styles from './MarkdownWorkbench.module.css';

export function TableEditorDialog({ initial, onSave, onClose }: { initial: EditableTable; onSave: (source: string) => void; onClose: () => void }) {
  const [table, setTable] = useState(initial);
  const [column, setColumn] = useState(0);
  return <EditorDialog title="Editar tabela" onClose={onClose}>
    <p>Edite as células e aplique para atualizar o Markdown.</p>
    <div className={styles.tableActions}>
      <button type="button" disabled={table.rows.length >= 100} onClick={() => setTable({ ...table, rows: [...table.rows, table.rows[0].map(() => '')] })}>+ Linha</button>
      <button type="button" disabled={table.alignments.length >= 20} onClick={() => setTable({ rows: table.rows.map(row => [...row, '']), alignments: [...table.alignments, 'left'] })}>+ Coluna</button>
      <label>Coluna <select value={column} onChange={event => setColumn(Number(event.target.value))}>{table.alignments.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></label>
      <label>Alinhamento <select value={table.alignments[column]} onChange={event => setTable({ ...table, alignments: table.alignments.map((value, index) => index === column ? event.target.value as 'left' | 'center' | 'right' : value) })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
      <button type="button" onClick={() => setTable({ ...table, rows: [table.rows[0], ...table.rows.slice(1).sort((a,b) => a[column].localeCompare(b[column], 'pt-BR', { numeric: true }))] })}>Ordenar A–Z</button>
      <button type="button" disabled={table.alignments.length <= 1} onClick={() => { setTable({ rows: table.rows.map(row => row.filter((_, index) => index !== column)), alignments: table.alignments.filter((_, index) => index !== column) }); setColumn(0); }}>Excluir coluna</button>
    </div>
    <div className={styles.table}><table className={styles.cellEditor}><tbody>{table.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}><input aria-label={`${r === 0 ? 'Cabeçalho' : `Linha ${r}`} coluna ${c + 1}`} value={cell} onChange={event => setTable({ ...table, rows: table.rows.map((cells, index) => index === r ? cells.map((value, col) => col === c ? event.target.value : value) : cells) })}/></td>)}<td>{r > 0 && <button type="button" aria-label={`Excluir linha ${r}`} onClick={() => setTable({ ...table, rows: table.rows.filter((_, index) => index !== r) })}>×</button>}</td></tr>)}</tbody></table></div>
    <footer><button type="button" onClick={onClose}>Cancelar</button><button type="button" onClick={() => onSave(serializeTable(table))}>Aplicar tabela</button></footer>
  </EditorDialog>;
}
