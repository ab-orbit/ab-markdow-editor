import { mathBody, mathSpans, renderMath } from '@/lib/markdown/math';
import 'katex/dist/katex.min.css';
import { t } from '../../i18n';
import { createContext, useContext, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Extension, Node as EditorNode } from '@tiptap/core';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import CodeBlock from '@tiptap/extension-code-block';
import { NodeSelection, TextSelection, Plugin } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import { resolveAsset, type MarkdownAsset } from '@/lib/markdown/assets';
import { diagramIdentity, diagramSourceKey, diagramLanguage } from '@/lib/markdown/diagrams';
import type { MarkdownCommand, SourceRange } from './editorCommands';
import { DocumentIcon } from './DocumentIcon';
import { RenderedDiagram } from './RenderedDiagram';
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
  /** Insert a source-preserving inline Lucide marker at the visual selection. */
  insertIcon: (name: string) => void;
  insertLink: (text: string, href: string) => void;
  focus: () => void;
  /** Navigate to the original heading order without serializing or editing it. */
  revealHeading: (ordinal: number) => void;
}
interface RichMarkdownEditorProps {
  ref?: Ref<RichMarkdownEditorHandle>;
  value: string;
  onChange: (source: string) => void;
  assets: readonly MarkdownAsset[];
  diagramScope: string;
  disabled?: boolean;
  /** Focus a freshly created heading after the lazy editor becomes ready. */
  autoFocus?: boolean;
  /** Returning from the canvas supplies its ordinal and prepares adjacent writing paragraphs. */
  writeAfterDiagram?: number;
  onEditDiagram: (range: SourceRange) => void;
  onImageFiles: (files: File[]) => void;
}
const context = createContext<{ assets: readonly MarkdownAsset[]; scope: string; editDiagram: (code: string, start: number | null) => void }>({ assets: [], scope: "", editDiagram: () => {} });

function DiagramNode({ node, editor, getPos }: NodeViewProps) {
  const settings = useContext(context);
  function applyScene(code: string) {
    const position = getPos();
    if (typeof position !== 'number') throw new Error(t("O bloco mudou. Reabra o desenho para aplicar suas alterações."));
    const current = editor.state.doc.nodeAt(position);
    if (!current) throw new Error(t("O desenho não está mais nesta nota. O rascunho foi preservado."));
    const scroller = editor.view.dom.closest<HTMLElement>('[data-document-scroll]'), top = scroller?.scrollTop;
    const transaction = editor.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, code });
    // WebKit otherwise restores the editor's previous end-of-document selection
    // when the canvas closes, moving the edited diagram out of the viewport.
    transaction.setSelection(NodeSelection.create(transaction.doc, position)); editor.view.dispatch(transaction);
    requestAnimationFrame(() => { if (scroller?.isConnected && top !== undefined) scroller.scrollTop = top; });
  }
  return <NodeViewWrapper contentEditable={false} className={styles.richDiagram}><RenderedDiagram source={node.attrs.code} language={node.attrs.language} identity={diagramIdentity(settings.scope, node.attrs.code, node.attrs.diagramOrdinal, node.attrs.language)} legacyIdentity={`${settings.scope}:${node.attrs.sourceStart}`} onChange={editor.isEditable ? applyScene : undefined} onEdit={editor.isEditable ? () => settings.editDiagram(node.attrs.code, node.attrs.sourceStart) : undefined}/></NodeViewWrapper>;
}
function ImageNode({ node }: NodeViewProps) {
  const { assets } = useContext(context), asset = resolveAsset(node.attrs.src || "", assets);
  return <NodeViewWrapper as="span" contentEditable={false}>{asset ? <img className={styles.documentImage} src={asset.url} alt={node.attrs.alt || asset.file.name}/> : <span className={styles.image}>{t("Imagem ·")}{' '}{node.attrs.alt || t("sem descrição")}</span>}</NodeViewWrapper>;
}

function InlineIconNode({ node }: NodeViewProps) {
  return <NodeViewWrapper as="span" contentEditable={false}><DocumentIcon name={node.attrs.name} style={{ fontSize: 24 }}/></NodeViewWrapper>;
}
/** Formula atoms retain their exact imported Markdown until the formula itself is changed. */
function MathNode({ node, updateAttributes, editor }: NodeViewProps) {
  const [editing, setEditing] = useState(false), [value, setValue] = useState('');
  const canceled = useRef(false);
  const display = node.type.name === 'displayMath';
  function finish() {
    if (!canceled.current && value !== node.attrs.tex) updateAttributes({ tex: value, raw: display ? `$$\n${value}\n$$` : `$${value}$` });
    setEditing(false);
  }
  return <NodeViewWrapper as={display ? 'div' : 'span'} contentEditable={false} className={display ? 'scriba-math scriba-math-display' : 'scriba-math'}>
    {editing ? <input autoFocus aria-label={t('Fórmula LaTeX')} value={value} onChange={event=>setValue(event.target.value)} onBlur={finish} onKeyDown={event=>{ if(event.key==='Escape'){event.preventDefault();canceled.current=true;setEditing(false);}else if(event.key==='Enter'){event.preventDefault();finish();} }}/>
      : <button type="button" className="scriba-math-trigger" disabled={!editor.isEditable} aria-label={t('Editar fórmula')} onClick={()=>{canceled.current=false;setValue(node.attrs.tex);setEditing(true);}}><span dangerouslySetInnerHTML={{__html:renderMath(node.attrs.tex,display)}}/></button>}
  </NodeViewWrapper>;
}
function mathExtension(display: boolean) {
  const name = display ? 'displayMath' : 'inlineMath';
  return EditorNode.create({
    name, group: display ? 'block' : 'inline', inline: !display, atom: true,
    addAttributes: () => ({tex:{default:''},raw:{default:''}}),
    parseHTML: () => [], renderHTML: ({node}) => [display?'div':'span', {'data-tex':node.attrs.tex}],
    addNodeView: () => ReactNodeViewRenderer(MathNode, { stopEvent: () => true }),
    markdownTokenName: name,
    markdownTokenizer: {
      name, level: display ? 'block' : 'inline',
      start: source => mathSpans(source,!display).find(span=>span.display===display)?.from ?? -1,
      tokenize(source) { const span=mathSpans(source,!display)[0]; if(span?.from===0 && span.display===display)return {type:name,raw:span.raw,tex:span.tex}; },
    },
    parseMarkdown: token => ({type:name,attrs:{tex:token.tex,raw:token.raw}}),
    renderMarkdown: node => node.attrs?.raw || '',
  });
}
const InlineMath = mathExtension(false), DisplayMath = mathExtension(true);
const InlineIcon = EditorNode.create({
  name: 'documentIcon', group: 'inline', inline: true, atom: true,
  addAttributes: () => ({ name: { default: 'users' } }),
  parseHTML: () => [{ tag: 'i[data-lucide]', getAttrs: element => ({ name: element.getAttribute('data-lucide') }) }],
  renderHTML: ({ node }) => ['i', { 'data-lucide': node.attrs.name, style: 'font-size:24px' }],
  addNodeView: () => ReactNodeViewRenderer(InlineIconNode),
  markdownTokenName: 'documentIcon',
  markdownTokenizer: {
    name: 'documentIcon', level: 'inline', start: source => source.indexOf('<i '),
    tokenize(source) {
      const match = /^<i data-lucide="([a-z0-9-]+)" style="font-size:24px"><\/i>/.exec(source);
      if (match) return { type: 'documentIcon', raw: match[0], name: match[1] };
    },
  },
  parseMarkdown: token => ({ type: 'documentIcon', attrs: { name: token.name } }),
  renderMarkdown: node => `<i data-lucide="${node.attrs?.name}" style="font-size:24px"></i>`,
});
const SourceOnly = EditorNode.create({
  name: 'sourceOnly', group: 'block', atom: true, selectable: false, isolating: true,
  addAttributes: () => ({ raw: { default: "" } }),
  parseHTML: () => [],
  renderHTML: () => ['div', { 'data-source-only': "", hidden: true, contenteditable: 'false' }],
  renderMarkdown: node => node.attrs?.raw || "",
});
const SourceGroup = EditorNode.create({
  name: 'sourceGroup', group: 'block', content: 'block+', defining: true,
  parseHTML: () => [], renderHTML: () => ['div', { 'data-source-group': "" }, 0],
  renderMarkdown: (node, helpers) => helpers.renderChildren(node.content || [], '\n\n'),
});
const FootnoteReference = EditorNode.create({
  name: 'footnoteReference', group: 'inline', inline: true, atom: true,
  addAttributes: () => ({ label: { default: "" } }),
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
  addAttributes: () => ({ code: { default: "" }, language: { default: 'mermaid' }, diagramOrdinal: { default: 0, rendered: false } }),
  parseHTML: () => [], renderHTML: () => ['div', { 'data-mermaid-source': "" }],
  renderMarkdown: node => `\`\`\`${node.attrs?.language || 'mermaid'}\n${node.attrs?.code}\n\`\`\``,
  addNodeView: () => ReactNodeViewRenderer(DiagramNode, { stopEvent: () => true }),
});
const DiagramAwareCode = CodeBlock.extend({
  parseMarkdown(token, helpers) {
    if (/^(?:math|latex|tex)$/i.test(token.lang || "")) return helpers.createNode('displayMath', {tex:mathBody(token.text || ""),raw:token.raw || `\`\`\`math\n${token.text || ""}\n\`\`\``});
    const language = diagramLanguage(token.lang || "");
    if (language) return helpers.createNode('mermaidDiagram', { code: token.text || "", language });
    return helpers.createNode('codeBlock', { language: token.lang || null }, token.text ? [helpers.createTextNode(token.text)] : []);
  },
});
const LocalImage = Image.extend({
  // ProseMirror creates an initial DOM before React mounts node views. Never place a remote src there.
  renderHTML: ({ node }) => ['span', { 'data-local-image': node.attrs.src, 'aria-label': t("Imagem · {0}", node.attrs.alt || t("sem descrição")) }],
  addNodeView: () => ReactNodeViewRenderer(ImageNode),
}).configure({ inline: true, allowBase64: false });

/** IDs are private editor metadata; newly split/pasted nodes must never reuse another block's source. */
const SourceIdentity = Extension.create({
  name: 'sourceIdentity',
  addGlobalAttributes: () => [{
    types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'codeBlock', 'horizontalRule', 'table', 'sourceOnly', 'sourceGroup', 'mermaidDiagram', 'displayMath'],
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
          const key = `${node.attrs.language}:${diagramSourceKey(node.attrs.code)}`, ordinal = occurrences.get(key) || 0;
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
export default function RichMarkdownEditor({ ref, value, onChange, assets, diagramScope, disabled, autoFocus, writeAfterDiagram, onEditDiagram, onImageFiles }: RichMarkdownEditorProps) {
  const ledger = useRef(new ReadingSource());
  const echo = useRef<string | null>(null);
  const callbacks = useRef({ onChange, onImageFiles }); callbacks.current = { onChange, onImageFiles };
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ codeBlock: false, trailingNode: false, underline: false, link: { openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'] } }), Markdown, TableKit.configure({ table: { renderWrapper: true, resizable: false } }), TaskList, TaskItem.configure({ nested: true }), LocalImage, InlineIcon, InlineMath, DisplayMath, DiagramAwareCode, MermaidNode, FootnoteReference, SourceOnly, SourceGroup, SourceIdentity],
    content: "",
    editorProps: {
      attributes: { 'aria-label': t("Texto da nota"), 'aria-multiline': 'true', role: 'textbox', spellcheck: 'true', lang: 'pt-BR', class: styles.richContent },
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
  // Keyboard and rotation resize the visible viewport without moving the editor selection.
  // Scroll only its document pane far enough to keep the current caret above the tools/keyboard.
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    const revealCaret = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!editor.isFocused || editor.isDestroyed || !matchMedia("(max-width: 899px), (pointer: coarse)").matches) return;
        const pane = editor.view.dom.closest<HTMLElement>('[data-document-scroll]');
        if (!pane) return;
        const viewport = window.visualViewport, bounds = pane.getBoundingClientRect();
        const top = Math.max(bounds.top, viewport?.offsetTop || 0) + 8;
        let bottom = Math.min(bounds.bottom, (viewport?.offsetTop || 0) + (viewport?.height || innerHeight)) - 12;
        const tools = pane.closest('section')?.querySelector<HTMLElement>('[role="toolbar"]');
        if (tools && tools.getClientRects().length) bottom = Math.min(bottom, tools.getBoundingClientRect().top - 8);
        if (bottom <= top) return;
        const caret = editor.view.coordsAtPos(editor.state.selection.head);
        if (caret.bottom > bottom) pane.scrollTop += caret.bottom - bottom;
        else if (caret.top < top) pane.scrollTop += caret.top - top;
      });
    };
    const pane = editor.view.dom.closest<HTMLElement>('[data-document-scroll]');
    const resize = new ResizeObserver(revealCaret); if (pane) resize.observe(pane);
    const chrome = new MutationObserver(revealCaret), workbench = pane?.closest('section');
    if (workbench) chrome.observe(workbench, {attributes: true, attributeFilter: ['data-mobile-formatting']});
    editor.on('selectionUpdate', revealCaret); editor.on('focus', revealCaret);
    window.visualViewport?.addEventListener('resize', revealCaret);
    window.visualViewport?.addEventListener('scroll', revealCaret);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); chrome.disconnect(); editor.off('selectionUpdate', revealCaret); editor.off('focus', revealCaret); window.visualViewport?.removeEventListener('resize', revealCaret); window.visualViewport?.removeEventListener('scroll', revealCaret); };
  }, [editor]);
  const diagramWritingPrepared = useRef(false);
  useEffect(()=>{
    if(!editor || disabled || writeAfterDiagram===undefined || diagramWritingPrepared.current || echo.current!==value)return;
    const frame=requestAnimationFrame(()=>{
      if(editor.isDestroyed)return;
      let ordinal=0,position:number|undefined;
      editor.state.doc.forEach((node,offset)=>{if(node.type.name==='mermaidDiagram' && node.attrs.language==='excalidraw' && ordinal++===writeAfterDiagram)position=offset;});
      if(position===undefined)return;
      const paragraph=editor.schema.nodes.paragraph,transaction=editor.state.tr;
      if(position===0){const before=paragraph.create();transaction.insert(0,before);position+=before.nodeSize;}
      const drawing=transaction.doc.nodeAt(position)!;
      const after=position+drawing.nodeSize;
      if(transaction.doc.nodeAt(after)?.type.name!=='paragraph')transaction.insert(after,paragraph.create());
      transaction.setSelection(TextSelection.create(transaction.doc,after+1));
      editor.view.dispatch(transaction.scrollIntoView());editor.view.focus();diagramWritingPrepared.current=true;
    });
    return()=>cancelAnimationFrame(frame);
  },[editor,disabled,writeAfterDiagram,value]);
  const initiallyFocused = useRef(false);
  useEffect(() => {
    if (editor && autoFocus && !disabled && !initiallyFocused.current) {
      const frame = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        editor.commands.setTextSelection(Math.max(1, editor.state.doc.content.size - 1));
        editor.view.focus(); initiallyFocused.current = true;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [editor, autoFocus, disabled]);
  useImperativeHandle(ref, () => ({
    focus: () => { editor?.commands.focus(); },
    revealHeading: ordinal => {
      if (!editor) return;
      let index = 0, position: number | undefined;
      editor.state.doc.descendants((node, offset) => { if (node.type.name === 'heading' && index++ === ordinal) position = offset; });
      if (position === undefined) return;
      editor.commands.setTextSelection(position + 1); editor.view.focus();
      const element = editor.view.nodeDOM(position);
      if (element instanceof HTMLElement) element.scrollIntoView({ block: 'start', inline: 'nearest' });
    },
    selectedText: () => editor ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n') : "",
    insertIcon: name => { editor?.chain().focus().insertContent({ type: 'documentIcon', attrs: { name } }).run(); },
    insertMarkdown: source => { if (editor) editor.chain().focus().insertContent(editor.markdown!.parse(source).content || []).run(); },
    insertLink: (text, href) => { editor?.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href, target: '_blank', rel: "noopener noreferrer" } }] }).run(); },
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
          chain.insertContent({ type: 'footnoteReference', attrs: { label } }).command(({ tr, state }) => { tr.insert(tr.doc.content.size, state.schema.nodes.sourceOnly.create({ raw: t("[^{0}]: Insira a referência.", label) })); return true; }).run();
          break;
        }
      }
    },
  }), [editor, disabled]);

  function editDiagram(code: string, preferredStart: number | null) {
    const source = editor ? ledger.current.serialize(editor) : value;
    const fences = /(^|\n)([ \t]*)(`{3,}|~{3,})(?:mermaid|zenuml|excalidraw)[^\n]*\n([\s\S]*?)\n\2\3/gi;
    let match: RegExpExecArray | null, closest: SourceRange | null = null, distance = Infinity;
    const normalize = (text: string) => text.replace(/\r\n?/g, '\n').replace(/\n+$/, "");
    while ((match = fences.exec(source))) {
      if (normalize(match[4]) !== normalize(code)) continue;
      const from = match.index + match[1].length;
      const delta = Math.abs(from - (preferredStart ?? from));
      if (delta < distance) { distance = delta; closest = { from, to: match.index + match[0].length }; }
    }
    if (closest) onEditDiagram(closest);
  }
  return <context.Provider value={{ assets, scope: diagramScope, editDiagram }}><article className={`${styles.reading} ${styles.richReading}`} aria-label={t("Prévia Markdown")} data-visual-editor><EditorContent editor={editor}/></article></context.Provider>;
}
