export interface EditableTable {
  /** First row contains header cells; the remaining rows contain body cells. */
  rows: string[][];
  /** Per-column Markdown alignment. */
  alignments: ('left' | 'center' | 'right')[];
}

/** Split pipes except escaped pipes and pipes inside matching backtick runs. */
function cells(line: string): string[] {
  const result: string[] = []; let cell = ''; let ticks = 0;
  const source = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '\\' && source[index + 1] === '|') { cell += '|'; index++; continue; }
    if (char === '`') {
      let length = 1; while (source[index + length] === '`') length++;
      if (!ticks) ticks = length; else if (ticks === length) ticks = 0;
      cell += '`'.repeat(length); index += length - 1; continue;
    }
    if (char === '|' && !ticks) { result.push(cell.trim()); cell = ''; } else cell += char;
  }
  result.push(cell.trim()); return result;
}

export function parseEditableTable(source: string): EditableTable {
  const lines = source.trim().split(/\r?\n/);
  const header = cells(lines[0]); const separators = cells(lines[1] ?? '');
  if (lines.length < 2 || separators.length !== header.length || separators.some(cell => !/^:?-+:?$/.test(cell))) throw new Error('Selecione uma tabela Markdown válida.');
  const rows = [header, ...lines.slice(2).filter(line => line.trim()).map(line => {
    const row = cells(line); return header.map((_, index) => row[index] ?? '');
  })];
  if (header.length > 20 || rows.length > 100) throw new Error('A edição visual aceita até 20 colunas e 100 linhas. Edite tabelas maiores na fonte.');
  return { rows, alignments: separators.map(cell => cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left') };
}

export function serializeTable(table: EditableTable): string {
  const row = (cells: string[]) => `| ${cells.map(cell => cell.replace(/\r?\n/g, ' ').replace(/\\\|/g, '|').replace(/\|/g, '\\|')).join(' | ')} |`;
  return [row(table.rows[0]), row(table.alignments.map(alignment => alignment === 'center' ? ':---:' : alignment === 'right' ? '---:' : '---')), ...table.rows.slice(1).map(row)].join('\n');
}
