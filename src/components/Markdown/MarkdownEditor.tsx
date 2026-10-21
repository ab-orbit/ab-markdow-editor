import { useLanguage } from '../../i18n';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Annotation, Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { editorExtensions, livePreviewExtension } from './editorExtensions';
import { runMarkdownCommand, sourceTables, type MarkdownCommand, type SourceRange } from './editorCommands';
import type { MarkdownAsset } from '@/lib/markdown/assets';
import { imageDecorations } from './imageDecorations';
import { diagramDecorations } from './diagramDecorations';
import {rawBlockField,revealBlock,revealBlockEffect,finishBlock,blockEditingFinished} from './blockEditing';

export interface MarkdownEditorHandle {
  /** Apply an undoable formatting command to the current selection. */
  command: (command: MarkdownCommand) => void;
  /** Snapshot source offsets before opening a picker or dialog. */
  selection: () => SourceRange;
  /** Insert or replace source at explicit offsets in one undo step. */
  replace: (text: string, range?: SourceRange) => void;
  /** Reveal a source block, retaining the surrounding live preview. */
  editBlock: (range?: SourceRange) => void;
  /** Finish the temporary source-block presentation. */
  finishBlock: () => void;
  /** Return syntax-tree table ranges in the current source. */
  tables: () => SourceRange[];
  /** Navigate without changing the source or adding an undo entry. */
  revealPosition: (position: number, focus?: boolean, scroll?: boolean) => void;
  /** One-based source line at the visible document edge, for the outline. */
  visibleLine: (top: number) => number;
  /** Source coordinate at the viewport edge, used for bidirectional split synchronization. */
  visibleSourcePosition: (top: number) => number;
  scrollToSourcePosition: (position: number, scroller: HTMLElement, padding?: number) => void;
  /** Map source text positions to viewport geometry without moving focus. */
  sourcePositionY: (position: number) => number;
  selectSourcePosition: (position: number) => void;
}

export interface MarkdownEditorProps {
  /** Private document identity used only for diagram presentation preferences. */
  diagramScope?: string;
  /** Canonical Markdown source, controlled by the host application. */
  value: string;
  /** Receives document edits without a Markdown-to-HTML round trip. */
  onChange: (value: string) => void;
  /** Report selected source characters without lifting selection into document state. */
  onSelectionChange?: (characters: number) => void;
  /** Hide inactive delimiters while retaining an editable source document. */
  livePreview?: boolean;
  /** Enable the optional double-click gesture in live preview. */
  doubleClickToEdit?: boolean;
  /** Report the transient block range and explicit completion without changing the document. */
  onBlockEditChange?: (range: SourceRange | null, finished: boolean) => void;
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
export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor({ value, onChange, onSelectionChange, livePreview = true, doubleClickToEdit = true, onBlockEditChange, readOnly = false, assets = noAssets, onImageFiles, diagramScope = 'document' }: MarkdownEditorProps, ref) {
  const language = useLanguage();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const callback = useRef(onChange);
  const selectionCallback = useRef(onSelectionChange); selectionCallback.current = onSelectionChange;
  const initialValue = useRef(value);
  const imageCallback = useRef(onImageFiles);
  const blockCallback = useRef(onBlockEditChange);blockCallback.current=onBlockEditChange;
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
    editBlock: range => {if(editor.current)revealBlock(editor.current,range?.from);},
    finishBlock: () => {if(editor.current)finishBlock(editor.current);},
    tables: () => editor.current ? sourceTables(editor.current.state) : [],
    revealPosition: (position, focus = true, scroll = true) => {
      const view = editor.current;
      if (!view) return;
      const anchor = Math.max(0, Math.min(view.state.doc.length, position));
      view.dispatch({ selection: { anchor }, effects: scroll ? EditorView.scrollIntoView(anchor, { y: 'start', yMargin: 24 }) : [] });
      if (focus) view.focus();
    },
    visibleSourcePosition: top => {
      const view = editor.current; if (!view) return 0;
      const bounds = view.contentDOM.getBoundingClientRect();
      return view.posAtCoords({ x: bounds.left + 30, y: Math.max(top + 2, bounds.top + 1) }, false) ?? 0;
    },
    sourcePositionY: position => {
      const view = editor.current; if (!view) return 0;
      const anchor = Math.max(0, Math.min(view.state.doc.length, position));
      return view.coordsAtPos(anchor)?.top ?? view.documentTop + view.lineBlockAt(anchor).top;
    },
    selectSourcePosition: position => {
      const view = editor.current; if (!view) return;
      const anchor = Math.max(0, Math.min(view.state.doc.length, position));
      view.dispatch({ selection: { anchor } });
    },
    scrollToSourcePosition: (position, _scroller, padding = 0) => {
      const view = editor.current; if (!view) return;
      const anchor = Math.max(0, Math.min(view.state.doc.length, position));
      // Let CodeMirror measure virtualized lines and scroll their ancestor pane.
      // This changes presentation only: selection, text and focus are preserved.
      view.dispatch({ effects: EditorView.scrollIntoView(anchor, { y: 'start', yMargin: Math.max(0, padding) }) });
    },
    visibleLine: top => {
      const view = editor.current;
      if (!view) return 1;
      const bounds = view.contentDOM.getBoundingClientRect();
      const position = view.posAtCoords({ x: bounds.left + 8, y: Math.max(top + 24, bounds.top + 1) }, false);
      return view.state.doc.lineAt(position ?? view.state.selection.main.head).number;
    },
  }), []);

  useEffect(() => { editor.current?.dispatch({}); }, [language]);
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
          if ((update.selectionSet || update.docChanged || update.focusChanged) && update.view.hasFocus && !host.current?.closest('[hidden]')) {
            selectionCallback.current?.(update.state.selection.ranges.reduce((total, range) => total + range.to - range.from, 0));
          }
          const previous=update.startState.field(rawBlockField),next=update.state.field(rawBlockField);
          if(previous?.from!==next?.from||previous?.to!==next?.to)blockCallback.current?.(next,update.transactions.some(transaction=>transaction.annotation(blockEditingFinished)));
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
      compartments.live.reconfigure(livePreview ? livePreviewExtension(doubleClickToEdit) : []),
      ...(!livePreview?[revealBlockEffect.of(null)]:[]),
      compartments.editable.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
      compartments.images.reconfigure(livePreview ? [imageDecorations(assets), diagramDecorations(diagramScope)] : []),
    ] });
  }, [livePreview, doubleClickToEdit, readOnly, compartments, assets, diagramScope]);

  return <div ref={host} data-testid="markdown-editor" />;
});
