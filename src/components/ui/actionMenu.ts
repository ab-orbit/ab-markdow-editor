import type { KeyboardEvent } from 'react';

/** Shared command navigation for modal, portal and details-based menus. */
export function navigateActionMenu(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false;
  if (event.currentTarget instanceof HTMLDetailsElement) event.currentTarget.open = true;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    .filter(item => item.getClientRects().length > 0 && item.getAttribute('aria-disabled') !== 'true');
  if (!items.length) return false;
  event.preventDefault(); event.stopPropagation();
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index < 0
    ? event.key === 'ArrowUp' ? items.length - 1 : 0
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next].focus(); items[next].scrollIntoView({ block: 'nearest' });
  return true;
}

/** Details-based menus share dismissal and never leave two command surfaces open. */
export function handleDetailsMenu(event: KeyboardEvent<HTMLElement>) {
  if (navigateActionMenu(event)) return;
  if (event.key !== 'Escape' || !(event.currentTarget instanceof HTMLDetailsElement)) return;
  event.preventDefault(); event.stopPropagation();
  event.currentTarget.open=false;
  event.currentTarget.querySelector('summary')?.focus();
}
export function closeOtherDetailsMenus(current: HTMLDetailsElement) {
  if (!current.open) return;
  document.querySelectorAll<HTMLDetailsElement>('details[data-ui-menu][open]').forEach(menu=>{if(menu!==current)menu.open=false;});
}
export function dismissDetailsMenus(target: EventTarget | null) {
  if (!(target instanceof Node)) return;
  document.querySelectorAll<HTMLDetailsElement>('details[data-ui-menu][open]').forEach(menu=>{if(!menu.contains(target))menu.open=false;});
}
