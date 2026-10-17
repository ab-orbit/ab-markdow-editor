import { Bold, Italic, Strikethrough, Code, Braces, Quote, List, ListOrdered, ListChecks, Minus, Table2, Link, ImagePlus, Undo2, Redo2, IndentIncrease, IndentDecrease, Superscript } from 'lucide-react';
import type { MarkdownCommand } from './editorCommands';
import styles from './MarkdownWorkbench.module.css';

const groups = [
  [{ command: 'undo', label: 'Desfazer', Icon: Undo2 }, { command: 'redo', label: 'Refazer', Icon: Redo2 }],
  [{ command: 'bold', label: 'Negrito', Icon: Bold }, { command: 'italic', label: 'Itálico', Icon: Italic }, { command: 'strike', label: 'Tachado', Icon: Strikethrough }],
  [{ command: 'bullet', label: 'Lista', Icon: List }, { command: 'ordered', label: 'Lista numerada', Icon: ListOrdered }, { command: 'task', label: 'Tarefas', Icon: ListChecks }, { command: 'quote', label: 'Citação', Icon: Quote }],
  [{ command: 'indent', label: 'Aumentar recuo', Icon: IndentIncrease }, { command: 'outdent', label: 'Diminuir recuo', Icon: IndentDecrease }],
  [{ command: 'code', label: 'Código inline', Icon: Code }, { command: 'codeblock', label: 'Bloco de código', Icon: Braces }, { command: 'rule', label: 'Separador', Icon: Minus }],
] as const;

export function EditingToolbar({ disabled, onCommand, onLink, onImage }: { disabled: boolean; onCommand: (command: MarkdownCommand) => void; onLink: () => void; onImage: () => void }) {
  return <div className={styles.editingToolbar} role="toolbar" aria-label="Ferramentas de edição">
    <select disabled={disabled} aria-label="Estilo do parágrafo" value="" onChange={event => { onCommand(event.target.value as MarkdownCommand); }}>
      <option value="" disabled>Título / texto</option><option value="paragraph">Texto</option><option value="heading1">Título 1</option><option value="heading2">Título 2</option><option value="heading3">Título 3</option>
    </select>
    {groups.map((group, index) => <div className={styles.toolGroup} key={index}>
      {group.map(({ command, label, Icon }) => <button type="button" key={command} title={label} aria-label={label} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => onCommand(command)}><Icon size={16} aria-hidden="true"/></button>)}
    </div>)}
    <div className={styles.toolGroup}>
      <button type="button" disabled={disabled} onClick={onLink} title="Inserir link" aria-label="Inserir link"><Link size={16} aria-hidden="true"/></button>
      <button type="button" disabled={disabled} onClick={() => onCommand('footnote')} title="Inserir referência" aria-label="Inserir referência"><Superscript size={16} aria-hidden="true"/></button>
      <button type="button" disabled={disabled} onClick={() => onCommand('table')} title="Inserir tabela" aria-label="Inserir tabela"><Table2 size={16} aria-hidden="true"/></button>
      <button type="button" disabled={disabled} onClick={onImage} className={styles.imageTool}><ImagePlus size={16} aria-hidden="true"/>Imagem</button>
    </div>
  </div>;
}
