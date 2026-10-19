import { createContext, useContext, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Extension, Node as EditorNode } from '@tiptap/core';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import CodeBlock from '@tiptap/extension-code-block';
import { Plugin } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import { resolveAsset, type MarkdownAsset } from '@/lib/markdown/assets';
import { diagramIdentity, diagramSourceKey } from '@/lib/markdown/diagrams';
import type { MarkdownCommand, SourceRange } from './editorCommands';
import { DiagramBlock } from './DiagramBlock';
import { ReadingSource } from './readingSource';
import styles from './MarkdownWorkbench.module.css';

declare module '@tiptap/core' {
  interface Storage {
    /** Disable source-only node protection while applying an explicit source replacement. */
    sourceIdentity: { loading: boolean };
  }
}

export interface RichMarkdownEditorHandle {
  /** Apply formatting to the current rendered selection without exposing Markdown markers. */
  command: (command: MarkdownCommand) => void;
  selectedText: () => string;
  insertMarkdown: (source: string) => void;
  insertLink: (text: string, href: string) => void;
  focus: () => void;
}
interface RichMarkdownEditorProps {
  ref?: Ref<RichMarkdownEditorHandle>;
  value: string;
  onChange: (source: string) => void;
  assets: readonly MarkdownAsset[];
  diagramScope: string;
  disabled?: boolean;
  onEditDiagram: (range: SourceRange) => void;
  onImageFiles: (files: File[]) => void;
}
const context = createContext<{ assets: readonly MarkdownAsset[]; scope: string; editDiagram: (code: string, start: number | null) => void }>({ assets: [], scope: '', editDiagram: () => {} });

function DiagramNode({ node }: NodeViewProps) {
  const settings = useContext(context);
  return <NodeViewWrapper contentEditable={false} className={styles.richDiagram}><DiagramBlock source={node.attrs.code} identity={diagramIdentity(settings.scope, node.attrs.code, node.attrs.diagramOrdinal)} legacyIdentity={`${settings.scope}:${node.attrs.sourceStart}`} onEdit={() => settings.editDiagram(node.attrs.code, node.attrs.sourceStart)}/></NodeViewWrapper>;
}
function ImageNode({ node }: NodeViewProps) {
  const { assets } = useContext(context), asset = resolveAsset(node.attrs.src || '', assets);
  return <NodeViewWrapper as="span" contentEditable={false}>{asset ? <img className={styles.documentImage} src={asset.url} alt={node.attrs.alt || asset.file.name}/> : <span className={styles.image}>Imagem · {node.attrs.alt || 'sem descrição'}</span>}</NodeViewWrapper>;
}

const SourceOnly = EditorNode.create({
  name: 'sourceOnly', group: 'block', atom: true, selectable: false, isolating: true,
  addAttributes: () => ({ raw: { default: '' } }),
  parseHTML: () => [],
  renderHTML: () => ['div', { 'data-source-only': '', hidden: true, contenteditable: 'false' }],
  renderMarkdown: node => node.attrs?.raw || '',
});
const SourceGroup = EditorNode.create({
  name: 'sourceGroup', group: 'block', content: 'block+', defining: true,
  parseHTML: () => [], renderHTML: () => ['div', { 'data-source-group': '' }, 0],
  renderMarkdown: (node, helpers) => helpers.renderChildren(node.content || [], '\n\n'),
});
const FootnoteReference = EditorNode.create({
  name: 'footnoteReference', group: 'inline', inline: true, atom: true,
  addAttributes: () => ({ label: { default: '' } }),
  parseHTML: () => [{ tag: 'sup[data-footnote-label]', getAttrs: element => ({ label: element.getAttribute('data-footnote-label') }) }],
  renderHTML: ({ node }) => ['sup', { 'data-footnote-label': node.attrs.label, contenteditable: 'false' }, node.attrs.label],
  markdownTokenName: 'footnoteReference',
  markdownTokenizer: {
    name: 'footnoteReference', level: 'inline', start: source => source.indexOf('[^'),
    tokenize(source) {
      const match = /^\[\^([^\]\r\n]+)\]/.exec(source);
      if (match) return { type: 'footnoteReference', raw: match[0], label: match[1] };
    },
  },
  parseMarkdown: token => ({ type: 'footnoteReference', attrs: { label: token.label } }),
  renderMarkdown: node => `[^${node.attrs?.label}]`,
});
const MermaidNode = EditorNode.create({
  name: 'mermaidDiagram', group: 'block', atom: true, isolating: true,
  addAttributes: () => ({ code: { default: '' }, diagramOrdinal: { default: 0, rendered: false } }),
  parseHTML: () => [], renderHTML: () => ['div', { 'data-mermaid-source': '' }],
  renderMarkdown: node => `\`\`\`mermaid\n${node.attrs?.code}\n\`\`\``,
  addNodeView: () => ReactNodeViewRenderer(DiagramNode, { stopEvent: () => true }),
});
const DiagramAwareCode = CodeBlock.extend({
  parseMarkdown(token, helpers) {
    if ((token.lang || '').trim().toLowerCase() === 'mermaid') return helpers.createNode('mermaidDiagram', { code: token.text || '' });
    return helpers.createNode('codeBlock', { language: token.lang || null }, token.text ? [helpers.createTextNode(token.text)] : []);
  },
});
const LocalImage = Image.extend({
  // ProseMirror creates an initial DOM before React mounts node views. Never place a remote src there.
  renderHTML: ({ node }) => ['span', { 'data-local-image': node.attrs.src, 'aria-label': `Imagem · ${node.attrs.alt || 'sem descrição'}` }],
  addNodeView: () => ReactNodeViewRenderer(ImageNode),
}).configure({ inline: true, allowBase64: false });

/** IDs are private editor metadata; newly split/pasted nodes must never reuse another block's source. */
const SourceIdentity = Extension.create({
  name: 'sourceIdentity',
  addGlobalAttributes: () => [{
    types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'codeBlock', 'horizontalRule', 'table', 'sourceOnly', 'sourceGroup', 'mermaidDiagram'],
    attributes: { sourceId: { default: null, rendered: false }, sourceStart: { default: null, rendered: false } },
  }],
  addProseMirrorPlugins() {
    const extension = this;
    return [new Plugin({
      appendTransaction(transactions, oldState, newState) {
        if (!transactions.some(transaction => transaction.docChanged)) return null;
        const tr = newState.tr, seen = new Set<string>();
        newState.doc.forEach((node, position) => {
          if (!node.attrs.sourceId || seen.has(node.attrs.sourceId)) tr.setNodeMarkup(position, undefined, { ...node.attrs, sourceId: crypto.randomUUID(), sourceStart: null });
          seen.add(node.attrs.sourceId);
        });
        const occurrences = new Map<string, number>();
        newState.doc.descendants((node, position) => {
          if (node.type.name !== 'mermaidDiagram') return;
          const key = diagramSourceKey(node.attrs.code), ordinal = occurrences.get(key) || 0;
          occurrences.set(key, ordinal + 1);
          if (node.attrs.diagramOrdinal !== ordinal) {
            const current = tr.doc.nodeAt(position)!;
            tr.setNodeMarkup(position, undefined, { ...current.attrs, diagramOrdinal: ordinal });
          }
        });
        // Hidden definitions/comments cannot be removed accidentally by Backspace or Select All.
        // Explicit edits in Fonte can still change them; source reloads bypass this protection.
        if (!extension.storage.loading) {
          const mapping = new Mapping();
          transactions.forEach(transaction => mapping.appendMapping(transaction.mapping));
          oldState.doc.forEach((node, position) => {
            if (node.type.name !== 'sourceOnly' || node.attrs.sourceStart === null || seen.has(node.attrs.sourceId)) return;
            const mapped = Math.min(tr.doc.content.size, tr.mapping.map(mapping.map(position, -1)));
            const resolved = tr.doc.resolve(Math.max(0, mapped));
            tr.insert(resolved.depth ? resolved.before(1) : resolved.pos, node);
          });
        }
        return tr.steps.length ? tr.setMeta('addToHistory', false) : null;
      },
    })];
  },
  addStorage: () => ({ loading: false }),
});

/** A lazy, source-preserving visual editor. Markdown remains the host's only saved document. */
export default function RichMarkdownEditor({ ref, value, onChange, assets, diagramScope, disabled, onEditDiagram, onImageFiles }: RichMarkdownEditorProps) {
  const ledger = useRef(new ReadingSource());
  const echo = useRef<string | null>(null);
  const callbacks = useRef({ onChange, onImageFiles }); callbacks.current = { onChange, onImageFiles };
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ codeBlock: false, trailingNode: false, underline: false, link: { openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'] } }), Markdown, TableKit.configure({ table: { renderWrapper: true, resizable: false } }), TaskList, TaskItem.configure({ nested: true }), LocalImage, DiagramAwareCode, MermaidNode, FootnoteReference, SourceOnly, SourceGroup, SourceIdentity],
    content: '',
    editorProps: {
      attributes: { 'aria-label': 'Texto da nota', 'aria-multiline': 'true', role: 'textbox', spellcheck: 'true', lang: 'pt-BR', class: styles.richContent },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
        if (!files.length) return false;
        callbacks.current.onImageFiles(files); return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter(file => file.type.startsWith('image/'));
        if (!files.length) return false;
        callbacks.current.onImageFiles(files); return true;
      },
    },
    onUpdate({ editor: instance, transaction }) {
      if (!transaction.docChanged || instance.storage.sourceIdentity.loading || echo.current === null) return;
      const source = ledger.current.serialize(instance);
      if (source !== echo.current) { echo.current = source; callbacks.current.onChange(source); }
    },
  });
  useEffect(() => {
    if (!editor || echo.current === value) return;
    editor.storage.sourceIdentity.loading = true;
    try { ledger.current.load(value, editor); echo.current = value; }
    finally { editor.storage.sourceIdentity.loading = false; }
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  useImperativeHandle(ref, () => ({
    focus: () => { editor?.commands.focus(); },
    selectedText: () => editor ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n') : '',
    insertMarkdown: source => { if (editor) editor.chain().focus().insertContent(editor.markdown!.parse(source).content || []).run(); },
    insertLink: (text, href) => { editor?.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }] }).run(); },
    command(action) {
      if (!editor || disabled) return;
      const chain = editor.chain().focus();
      switch (action) {
        case 'bold': chain.toggleBold().run(); break;
        case 'italic': chain.toggleItalic().run(); break;
        case 'strike': chain.toggleStrike().run(); break;
        case 'code': chain.toggleCode().run(); break;
        case 'codeblock': chain.toggleCodeBlock().run(); break;
        case 'quote': chain.toggleBlockquote().run(); break;
        case 'bullet': chain.toggleBulletList().run(); break;
        case 'ordered': chain.toggleOrderedList().run(); break;
        case 'task': chain.toggleTaskList().run(); break;
        case 'rule': chain.setHorizontalRule().run(); break;
        case 'table': chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
        case 'heading1': case 'heading2': case 'heading3': chain.setHeading({ level: Number(action.at(-1)) as 1 | 2 | 3 }).run(); break;
        case 'paragraph': chain.setParagraph().run(); break;
        case 'indent': chain.sinkListItem(editor.isActive('taskItem') ? 'taskItem' : 'listItem').run(); break;
        case 'outdent': chain.liftListItem(editor.isActive('taskItem') ? 'taskItem' : 'listItem').run(); break;
        case 'undo': chain.undo().run(); break;
        case 'redo': chain.redo().run(); break;
        case 'footnote': {
          const existing = new Set<string>(); editor.state.doc.descendants(node => { if (node.type.name === 'footnoteReference') existing.add(node.attrs.label); });
          let number = 1; while (existing.has(String(number))) number++;
          const label = String(number);
          chain.insertContent({ type: 'footnoteReference', attrs: { label } }).command(({ tr, state }) => { tr.insert(tr.doc.content.size, state.schema.nodes.sourceOnly.create({ raw: `[^${label}]: Insira a referência.` })); return true; }).run();
          break;
        }
      }
    },
  }), [editor, disabled]);

  function editDiagram(code: string, preferredStart: number | null) {
    const source = editor ? ledger.current.serialize(editor) : value;
    const fences = /(^|\n)([ \t]*)(`{3,}|~{3,})mermaid[^\n]*\n([\s\S]*?)\n\2\3/g;
    let match: RegExpExecArray | null, closest: SourceRange | null = null, distance = Infinity;
    while ((match = fences.exec(source))) {
      if (match[4].replace(/\r\n?/g, '\n') !== code.replace(/\r\n?/g, '\n')) continue;
      const from = match.index + match[1].length;
      const delta = Math.abs(from - (preferredStart ?? from));
      if (delta < distance) { distance = delta; closest = { from, to: match.index + match[0].length }; }
    }
    if (closest) onEditDiagram(closest);
  }
  return <context.Provider value={{ assets, scope: diagramScope, editDiagram }}><article className={`${styles.reading} ${styles.richReading}`} aria-label="Prévia Markdown" data-visual-editor><EditorContent editor={editor}/></article></context.Provider>;
}
