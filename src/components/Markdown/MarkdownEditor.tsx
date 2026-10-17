import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Annotation, Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { editorExtensions, livePreviewExtension } from './editorExtensions';
import { runMarkdownCommand, sourceTables, type MarkdownCommand, type SourceRange } from './editorCommands';
import type { MarkdownAsset } from '@/lib/markdown/assets';
import { imageDecorations } from './imageDecorations';

export interface MarkdownEditorHandle {
  /** Apply an undoable formatting command to the current selection. */
  command: (command: MarkdownCommand) => void;
  /** Snapshot source offsets before opening a picker or dialog. */
  selection: () => SourceRange;
  /** Insert or replace source at explicit offsets in one undo step. */
  replace: (text: string, range?: SourceRange) => void;
  /** Return syntax-tree table ranges in the current source. */
  tables: () => SourceRange[];
}

export interface MarkdownEditorProps {
  /** Canonical Markdown source, controlled by the host application. */
  value: string;
  /** Receives document edits without a Markdown-to-HTML round trip. */
  onChange: (value: string) => void;
  /** Hide inactive delimiters while retaining an editable source document. */
  livePreview?: boolean;
  /** Disable document changes while allowing selection and copying. */
  readOnly?: boolean;
  /** Registered local images used by live image widgets. */
  assets?: readonly MarkdownAsset[];
  /** Receives pasted/dropped image files and the insertion range. */
  onImageFiles?: (files: File[], range: SourceRange) => void;
}

const externalChange = Annotation.define<boolean>();

/** A browser editor mounted after hydration; history survives mode switches. */
const noAssets: readonly MarkdownAsset[] = [];
export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor({ value, onChange, livePreview = true, readOnly = false, assets = noAssets, onImageFiles }: MarkdownEditorProps, ref) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const callback = useRef(onChange);
  const initialValue = useRef(value);
  const imageCallback = useRef(onImageFiles);
  const [compartments] = useState(() => ({ live: new Compartment(), editable: new Compartment(), images: new Compartment() }));

  useImperativeHandle(ref, () => ({
    command: command => { if (editor.current) runMarkdownCommand(editor.current, command); },
    selection: () => { const range = editor.current?.state.selection.main; return { from: range?.from ?? 0, to: range?.to ?? 0 }; },
    replace: (text, range) => {
      const view = editor.current;
      if (!view) return;
      const selection = range ?? view.state.selection.main;
      view.dispatch({ changes: { from: selection.from, to: selection.to, insert: text }, selection: { anchor: selection.from + text.length }, userEvent: 'input.insert' });
      view.focus();
    },
    tables: () => editor.current ? sourceTables(editor.current.state) : [],
  }), []);

  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => { imageCallback.current = onImageFiles; }, [onImageFiles]);
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: initialValue.current, extensions: [
        ...editorExtensions,
        compartments.live.of([]), compartments.editable.of([]), compartments.images.of([]),
        keymap.of([
          { key: 'Mod-b', run: view => { runMarkdownCommand(view, 'bold'); return true; } },
          { key: 'Mod-i', run: view => { runMarkdownCommand(view, 'italic'); return true; } },
          { key: 'Mod-Shift-x', run: view => { runMarkdownCommand(view, 'strike'); return true; } },
        ]),
        EditorView.domEventHandlers({
          paste(event, view) {
            const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'));
            if (!files.length || view.state.readOnly || !imageCallback.current) return false;
            event.preventDefault(); imageCallback.current(files, view.state.selection.main); return true;
          },
          drop(event, view) {
            const files = Array.from(event.dataTransfer?.files ?? []).filter(file => file.type.startsWith('image/'));
            if (!files.length || view.state.readOnly || !imageCallback.current) return false;
            event.preventDefault();
            const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
            imageCallback.current(files, { from: position, to: position }); return true;
          },
        }),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !update.transactions.some(transaction => transaction.annotation(externalChange))) {
            callback.current(update.state.doc.toString());
          }
        }),
      ] }),
    });
    editor.current = view;
    return () => { editor.current = null; view.destroy(); };
  }, [compartments]);

  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, annotations: externalChange.of(true) });
    }
  }, [value]);
  useEffect(() => {
    editor.current?.dispatch({ effects: [
      compartments.live.reconfigure(livePreview ? livePreviewExtension : []),
      compartments.editable.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
      compartments.images.reconfigure(livePreview ? imageDecorations(assets) : []),
    ] });
  }, [livePreview, readOnly, compartments, assets]);

  return <div ref={host} data-testid="markdown-editor" />;
});
