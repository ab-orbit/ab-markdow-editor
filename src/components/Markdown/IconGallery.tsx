import { t } from '../../i18n';
import { useEffect, useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { DocumentIcon } from './DocumentIcon';
import styles from './MarkdownWorkbench.module.css';
const recommended = ['users', 'git-branch', 'messages-square', 'network', 'building-2', 'map-pin', 'chart-no-axes-combined', 'file-text', 'link', 'circle-check'];

/** Search the bundled catalog locally and insert portable Markdown HTML at the saved selection. */
export function IconGallery({ onInsert, onClose }: { onInsert: (name: string) => void; onClose: () => void }) {
  const [names, setNames] = useState<string[]>([]), [query, setQuery] = useState(""), [limit, setLimit] = useState(80), [error, setError] = useState("");
  useEffect(() => { let active = true; void import('../../lib/markdown/iconCatalog').then(module => {
    if (active) setNames(Object.keys(module.iconCatalog).filter(name => !/^sparkles?$/.test(name)).sort((a, b) => {
      const ai = recommended.indexOf(a), bi = recommended.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
    }));
  }).catch(() => { if (active) setError(t("Não foi possível carregar os ícones. Feche e tente novamente.")); }); return () => { active = false; }; }, []);
  const results = names.filter(name => name.includes(query.trim().toLowerCase().replace(/\s+/g, '-')));
  return <EditorDialog title={t("Galeria de ícones")} onClose={onClose} className={styles.iconGallery}><p>{t("Selecione um ícone Lucide para inserir na nota. Os nomes do catálogo estão em inglês.")}</p><label className={styles.iconSearch}>{t("Buscar ícones")}<input type="search" autoFocus placeholder={t("users, git-branch, messages-square…")} value={query} onChange={event => { setQuery(event.target.value); setLimit(80); }}/></label><p role="status">{error || (!names.length ? t("Carregando catálogo…") : t("{0} ícones encontrados", results.length))}</p><div className={styles.iconGrid}>{results.slice(0, limit).map(name => <button type="button" key={name} title={name} aria-label={t("Inserir ícone {0}", name)} onClick={() => onInsert(name)}><DocumentIcon name={name}/><span>{name}</span></button>)}</div>{results.length > limit && <button type="button" onClick={() => setLimit(limit + 80)}>{t("Mostrar mais ícones")}</button>}{names.length > 0 && results.length === 0 && <p>{t("Nenhum ícone encontrado. Tente outro nome em inglês.")}</p>}</EditorDialog>;
}
