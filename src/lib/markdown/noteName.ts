import { t } from '../../i18n';
/** Derive a portable filename from a new note's first level-one heading. */
export function newNoteName(source: string, existing: readonly string[], createdAt = new Date()): string {
  const title = source.replace(/^\uFEFF/, '').split(/\r?\n/).find(line => /^#\s/.test(line))?.replace(/^#\s+/, '').replace(/\s+#+\s*$/, '').trim() || t("Nova nota");
  const stem = title.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`_]/g, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/[. ]+$/, '').replace(/\.md$/i, '').slice(0, 180).trim() || t("Nova nota");
  const occupied = new Set(existing.map(name => name.normalize('NFC').toLocaleLowerCase()));
  const timestamp = createdAt.toISOString().replace(/[:.]/g, "-");
  let name = `${stem} ${timestamp}.md`, suffix = 0;
  while (occupied.has(name.normalize('NFC').toLocaleLowerCase())) name = `${stem} ${timestamp} (${++suffix}).md`;
  return name;
}
