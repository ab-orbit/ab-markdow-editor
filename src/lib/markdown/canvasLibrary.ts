import type { LibraryItem, LibraryItems } from '@excalidraw/excalidraw/types';

export const LIBRARY_TYPES = ['architecture', 'charts', 'algorithms', 'icons', 'notes', 'diagrams', 'images', 'text', 'freehand', 'shapes'] as const;
export type LibraryType = typeof LIBRARY_TYPES[number];

/** Bundled collections retain their known type. Imported and personal items use their actual elements. */
export function libraryItemType(item: LibraryItem): LibraryType {
  if (/^scriba:(youritjang\/software-architecture|rohanp\/system-design):/.test(item.id)) return 'architecture';
  if (item.id.startsWith('scriba:dbssticky/data-viz:')) return 'charts';
  if (item.id.startsWith('scriba:intradeus/algorithms-')) return 'algorithms';
  if (/^scriba:(ferminrp\/awesome-icons|xxxdeveloper\/icons):/.test(item.id)) return 'icons';
  if (item.id.startsWith('scriba:ferminrp/post-it:')) return 'notes';
  const types = new Set(item.elements.filter(element => !element.isDeleted).map(element => element.type));
  if (types.has('image')) return 'images';
  if (types.size === 1 && types.has('text')) return 'text';
  if (types.size === 1 && types.has('freedraw')) return 'freehand';
  if (types.has('arrow') || types.has('line')) return 'diagrams';
  return 'shapes';
}

/** Stable ordering keeps the SDK's shift-selection range consistent with the displayed grid. */
export function sortedCanvasLibrary(items: LibraryItems): LibraryItems {
  return [...items].sort((a, b) => LIBRARY_TYPES.indexOf(libraryItemType(a)) - LIBRARY_TYPES.indexOf(libraryItemType(b)));
}

/** One entry per symbol, newest first. Existing data is treated defensively during upgrades. */
export function nextLibraryRecents(previous: unknown, used: readonly string[]): string[] {
  const stored = Array.isArray(previous) ? previous.filter((id): id is string => typeof id === 'string') : [];
  return [...new Set([...used, ...stored].filter(Boolean))].slice(0, 11);
}

export function recentLibraryItems(items: LibraryItems, ids: readonly string[]): LibraryItems {
  const byId = new Map(items.map(item => [item.id, item]));
  return nextLibraryRecents([], ids).flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}
