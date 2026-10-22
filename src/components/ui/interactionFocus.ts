import type { SyntheticEvent } from 'react';

// Safari doesn't focus buttons on touch. Retain a short invoker chain for nested command flows.
const recentControls: HTMLElement[] = [];
export function rememberInteractionControl(event: SyntheticEvent) {
  const element=(event.target as Element)?.closest?.<HTMLElement>('button,summary,input,select,textarea,a[href],[contenteditable="true"]');
  if (!element || recentControls.at(-1) === element) return;
  recentControls.push(element);
  if (recentControls.length > 8) recentControls.shift();
}
export function interactionFocusTarget() {
  return [...recentControls].reverse().find(element=>element.isConnected && !element.closest('dialog'))
    || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
}
