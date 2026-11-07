import { useEffect, useRef, useSyncExternalStore } from 'react';
import { iosBridge, isIosApp, type NativeWorkspaceLayout } from './ios';

const initial: NativeWorkspaceLayout = {nativeChrome: false, width: 0, height: 0, verticalBarEdge: 'none', posture: 'unavailable', occlusions: [], keyboardVisible: false, textScale: 1};
let layout = initial;
const subscribers = new Set<() => void>();
let started = false;

function publish(next: NativeWorkspaceLayout) {
  layout = next;
  const root = document.documentElement;
  root.dataset.nativeChrome = String(next.nativeChrome);
  root.dataset.barEdge = next.verticalBarEdge;
  root.dataset.posture = next.posture;
  root.dataset.nativeKeyboard = String(next.keyboardVisible);
  root.style.setProperty('--native-reading-scale', String(Math.max(1, next.textScale || 1)));
  subscribers.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  subscribers.add(listener);
  if (isIosApp && !started) {
    started = true;
    // Register before requesting the first snapshot so a fold during launch cannot be missed.
    void iosBridge.addListener('workspaceLayout', publish).then(() => iosBridge.workspaceLayout()).then(publish).catch(() => {});
    void iosBridge.addListener('workspaceCommand', command => window.dispatchEvent(new CustomEvent('scriba:native-command', {detail: command.id}))).catch(() => {});
  }
  return () => { subscribers.delete(listener); };
}
/** One native listener survives React's development StrictMode and document switches. */
export function useNativeWorkspace() {
  return useSyncExternalStore(subscribe, () => layout, () => initial);
}
/** Every command reuses the current document's existing guards, persistence and undo history. */
export function useNativeWorkspaceCommands(handler: (id: string) => void) {
  const current = useRef(handler); current.current = handler;
  useEffect(() => {
    const run = (event: Event) => current.current((event as CustomEvent<string>).detail);
    window.addEventListener('scriba:native-command', run);
    return () => window.removeEventListener('scriba:native-command', run);
  }, []);
}
