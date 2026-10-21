import { t } from '../../i18n';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { codeFolding, foldGutter, foldKeymap, HighlightStyle, LanguageDescription, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { Decoration, EditorView, keymap, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { languages } from '@codemirror/language-data';
import { tags } from '@lezer/highlight';
import { GFM } from '@lezer/markdown';
import {blockEditingInteractions,rawBlockContains,rawBlockField} from './blockEditing';

/** Reveal only the active inline span, or every delimiter in an explicitly opened block. */
const markerVisibility = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = this.build(view); }
  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged || update.startState.field(rawBlockField) !== update.state.field(rawBlockField) || syntaxTree(update.startState) !== syntaxTree(update.state)) {
      this.decorations = this.build(update.view);
    }
  }
  build(view: EditorView) {
    const ranges: ReturnType<Decoration['range']>[] = [];
    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({ from, to, enter(node) {
        if (!['HeaderMark', 'EmphasisMark', 'CodeMark', 'StrikethroughMark'].includes(node.name)) return;
        if (node.node.parent?.name === 'FencedCode') return;
        const parent=node.node.parent!;
        const selected=view.hasFocus&&(rawBlockContains(view.state,node.from,node.to)||view.state.selection.ranges.some(range=>range.empty?range.head>=parent.from&&range.head<=parent.to:range.from<parent.to&&range.to>parent.from));
        if(!selected)ranges.push(Decoration.replace({}).range(node.from,node.to));
        else ranges.push(Decoration.mark({class:'cm-markdown-marker'}).range(node.from,node.to));
      } });
    }
    return Decoration.set(ranges, true);
  }
}, { decorations: plugin => plugin.decorations });

/** CSS variables resolve in the editor subtree, including runtime theme changes. */
export const editorExtensions = [
  markdown({ extensions: [GFM], codeLanguages: info => {
    const name = info.split(/\s/)[0].toLowerCase();
    return LanguageDescription.matchLanguageName(languages, ['console', 'terminal', 'shellsession'].includes(name) ? 'shell' : name, true);
  } }), rawBlockField, history(), codeFolding(), foldGutter(), keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]), EditorView.lineWrapping,
  EditorView.contentAttributes.of(() => ({ 'aria-label': t("Conteúdo Markdown"), 'aria-multiline': 'true', role: 'textbox' })),
  syntaxHighlighting(HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--diagram-code-token-keyword)' },
    { tag: [tags.string, tags.attributeValue], color: 'var(--diagram-code-token-string)' },
    { tag: [tags.number, tags.bool, tags.null], color: 'var(--diagram-code-token-constant)' },
    { tag: tags.comment, color: 'var(--diagram-code-token-comment)' },
    { tag: [tags.function(tags.variableName), tags.tagName], color: 'var(--diagram-code-token-function)' },
    { tag: tags.attributeName, color: 'var(--diagram-code-token-keyword)' },
    { tag: tags.punctuation, color: 'var(--diagram-code-token-punctuation)' },
    { tag: tags.heading1, fontSize: '1.8em', fontWeight: '700', color: 'var(--text-primary)' },
    { tag: tags.heading2, fontSize: '1.4em', fontWeight: '700', color: 'var(--text-primary)' },
    { tag: tags.heading, fontWeight: '700', color: 'var(--text-primary)' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.link, color: 'var(--cyan)', textDecoration: 'underline' },
    { tag: tags.monospace, color: 'var(--lime)', fontFamily: 'var(--font-mono)' },
    { tag: tags.processingInstruction, color: 'var(--text-muted)' },
  ])),
  EditorView.theme({
    '&': { color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)', fontSize: "calc(15px * var(--ui-font-scale, 1))" },
    '.cm-content': { fontFamily: 'var(--font-mono)', padding: "28px 0", minHeight: '420px', lineHeight: '1.9', caretColor: 'var(--lime)' },
    '.cm-line': { padding: "0 28px" },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: 'var(--lime)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--lime-dim)' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-markdown-marker': {color:'var(--text-muted)',fontWeight:'400',fontStyle:'normal'},
    '.cm-gutters': { backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: 'none' },
  }),
];

export const livePreviewExtension = (doubleClickToEdit=true) => [markerVisibility,blockEditingInteractions(doubleClickToEdit)];
