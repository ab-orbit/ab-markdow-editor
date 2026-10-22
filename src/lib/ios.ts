import type { NativeUpdateInfo } from './appUpdates';
import { Capacitor, registerPlugin } from '@capacitor/core';

/** The native bridge is unavailable to ordinary web pages and never receives arbitrary URLs. */
export const isIosApp = import.meta.env.VITE_APP_PLATFORM === 'ios' && Capacitor.isNativePlatform();
export interface NativeNote {
  /** Path relative to the selected directory, without traversal segments. */
  name: string;
  /** UTF-8 Markdown, including its original BOM when present. */
  value: string;
  /** Actual source content digest, used to reject conflicting writes. */
  version: string;
  /** Source modification time, used by the recent notes list. */
  modifiedAt: string;
  /** Local raster attachments resolved within the selected directory. */
  files: { path: string; data: string; mime: string }[];
}
interface IosBridge {
  /** Accessibility material preferences come from UIKit, including WebKit's missing media query. */
  accessibilityPreferences(): Promise<{reduceTransparency: boolean; increaseContrast: boolean}>;
  /** Fixed-origin update lookup; no notes, credentials or device identifiers are sent. */
  updateInfo(): Promise<NativeUpdateInfo>;
  /** Open only the known distribution channel, never a remotely supplied URL. */
  openUpdate(options: {channel: 'app-store' | 'testflight'}): Promise<void>;
  /** Native system bars inherit the actual reading-theme tokens instead of a separate palette. */
  appearance(options: { dark: boolean; red: number; green: number; blue: number }): Promise<void>;
  /** Return a display name; security-scoped bookmarks remain exclusively in native storage. */
  folderStatus(): Promise<{ label: string }>;
  chooseFolder(): Promise<{ label: string }>;
  authorizeFolder(): Promise<void>;
  disconnectFolder(): Promise<void>;
  readNotes(): Promise<{ notes: NativeNote[] }>;
  saveNote(note: { name: string; value: string; files: { path: string; data: string }[] }): Promise<void>;
  /** Move a version-checked note within its authorized folder, preserving relative attachments. */
  renameNote(options: {name:string;newName:string;version:string}): Promise<void>;
  document(options: { name: string }): Promise<NativeNote>;
  documentVersion(options: { name: string }): Promise<{ version: string | null }>;
  /** Present the system share sheet, including Save to Files, for an explicitly exported artifact. */
  shareFile(options: { name: string; data: string }): Promise<void>;
  /** Transport only Scriba gateway routes; the session cookie stays in the Keychain. */
  githubRequest(options: { route: string; body?: string }): Promise<{ status: number; text: string }>;
  /** System browser authentication uses a short-lived, verifier-bound one-time handoff. */
  githubLogin(): Promise<void>;
  openExternal(options: { url: string }): Promise<void>;
}
export const iosBridge = registerPlugin<IosBridge>('ScribaNative');

/** Native export errors remain visible instead of silently discarding the user's file. */
export async function shareNativeBlob(blob: Blob, name: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  await iosBridge.shareFile({ name: name.split(/[\\/]/).at(-1) || 'documento.md', data: btoa(binary) });
}
