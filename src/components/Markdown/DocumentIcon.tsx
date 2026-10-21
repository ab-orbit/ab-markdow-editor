import { t } from '../../i18n';
import { lazy, Suspense, type CSSProperties } from 'react';

/** Load the local icon catalog only when a document requests an icon; no CDN is required. */
const CatalogIcon = lazy(async () => {
  const { iconCatalog } = await import('../../lib/markdown/iconCatalog');
  return { default: ({ name }: { name: string }) => {
    const Icon = Object.hasOwn(iconCatalog, name) ? iconCatalog[name] : undefined;
    return Icon ? <Icon size="1em" aria-hidden="true"/> : <span title={`Unknown icon: ${name}`}>[{name}]</span>;
  } };
});

export function DocumentIcon({ name, label, style }: { name: string; label?: string; style?: CSSProperties }) {
  return <span style={{ display: 'inline-flex', verticalAlign: 'middle', ...style }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-document-icon={name}><Suspense fallback={<span aria-hidden="true">…</span>}><CatalogIcon name={name}/></Suspense></span>;
}
