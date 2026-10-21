import { icons } from 'lucide-react';

/** Preserve acronym and numeric export names by indexing the actual bundled components. */
export const iconCatalog = Object.fromEntries(Object.entries(icons).map(([name, component]) => [
  name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(), component,
]));
