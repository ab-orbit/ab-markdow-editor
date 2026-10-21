import { t } from '../../i18n';
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state';
import { redo, undo } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';

export type MarkdownCommand = 'bold' | 'italic' | 'strike' | 'code' | 'codeblock' | 'quote' | 'bullet' | 'ordered' | 'task' | 'rule' | 'table' | 'footnote' | 'indent' | 'outdent' | 'undo' | 'redo' | 'heading1' | 'heading2' | 'heading3' | 'paragraph';
export interface SourceRange { /** Inclusive UTF-16 start. */ from: number; /** Exclusive UTF-16 end. */ to: number; }

/** Produce a source transaction, preserving selection for subsequent typing. */
export function formattingTransaction(state: EditorState, command: Exclude<MarkdownCommand, 'undo' | 'redo'>): TransactionSpec {
  const { from, to } = state.selection.main;
  const selected = state.sliceDoc(from, to);
  const marks = { bold: '**', italic: '*', strike: '~~', code: '`' };
  if (command in marks) {
    const mark = marks[command as keyof typeof marks];
    if (state.sliceDoc(Math.max(0, from - mark.length), from) === mark && state.sliceDoc(to, to + mark.length) === mark) {
      return { changes: [{ from: from - mark.length, to: from }, { from: to, to: to + mark.length }], selection: EditorSelection.range(from - mark.length, to - mark.length), userEvent: 'input.format' };
    }
    return { changes: { from, to, insert: `${mark}${selected}${mark}` }, selection: EditorSelection.range(from + mark.length, to + mark.length), userEvent: 'input.format' };
  }
  const blocks: Partial<Record<MarkdownCommand, string>> = {
    codeblock: `\n\n\`\`\`text\n${selected || 'código'}\n\`\`\`\n\n`, rule: '\n\n---\n\n',
    table: '\n\n| Coluna 1 | Coluna 2 |\n| --- | --- |\n| Valor 1 | Valor 2 |\n\n',
  };
  if (blocks[command]) return { changes: { from, to, insert: blocks[command] }, userEvent: 'input.format' };
  if (command === 'footnote') {
    const ids = [...state.doc.toString().matchAll(/\[\^(\d+)\]/g)].map(match => Number(match[1]));
    const id = ids.reduce((maximum, id) => Math.max(maximum, id), 0) + 1;
    const marker = `[^${id}]`; const definition = `\n\n[^${id}]: ${selected || t("Descreva a fonte aqui.")}\n`;
    return { changes: [{ from: to, insert: marker }, { from: state.doc.length, insert: definition }], selection: EditorSelection.cursor(to + marker.length), userEvent: 'input.format' };
  }
  const first = state.doc.lineAt(from); const last = state.doc.lineAt(to > from && state.doc.lineAt(to).from === to ? to - 1 : to);
  const lines = state.sliceDoc(first.from, last.to).split('\n');
  const prefixes = { quote: '> ', bullet: '- ', ordered: '1. ', task: '- [ ] ' };
  const prefix = prefixes[command as keyof typeof prefixes];
  const toggleOff = prefix && lines.every(line => command === 'ordered' ? /^\s*\d+\. /.test(line) : line.startsWith(prefix));
  const replacement = lines.map((line, index) => {
    if (command === 'indent') return `  ${line}`;
    if (command === 'outdent') return line.replace(/^(?:  |\t)/, '');
    if (command.startsWith('heading') || command === 'paragraph') return (command === 'paragraph' ? '' : `${'#'.repeat(Number(command.at(-1)))} `) + line.replace(/^#{1,6}\s+/, '');
    if (toggleOff) return command === 'ordered' ? line.replace(/^\s*\d+\. /, '') : line.slice(prefix.length);
    return `${command === 'ordered' ? `${index + 1}. ` : prefix}${line.replace(/^(?:> |[-*+] (?:\[[ xX]\] )?|\d+\. )/, '')}`;
  }).join('\n');
  return { changes: { from: first.from, to: last.to, insert: replacement }, selection: EditorSelection.range(first.from, first.from + replacement.length), userEvent: 'input.format' };
}

export function runMarkdownCommand(view: EditorView, command: MarkdownCommand): void {
  if (view.state.readOnly) return;
  if (command === 'undo') undo(view);
  else if (command === 'redo') redo(view);
  else view.dispatch(formattingTransaction(view.state, command));
  view.focus();
}

/** Only real parser Table nodes are exposed as table-editing targets. */
export function sourceTables(state: EditorState): SourceRange[] {
  const tables: SourceRange[] = [];
  syntaxTree(state).iterate({ enter(node) { if (node.name === 'Table') tables.push({ from: node.from, to: node.to }); } });
  return tables;
}
