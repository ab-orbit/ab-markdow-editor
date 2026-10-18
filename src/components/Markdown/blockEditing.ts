import {Annotation, EditorSelection, Prec, StateEffect, StateField, type EditorState} from '@codemirror/state';
import {syntaxTree} from '@codemirror/language';
import {EditorView, keymap} from '@codemirror/view';
import type {SourceRange} from './editorCommands';

/** The temporary source range is presentation state, never part of the saved Markdown. */
export const revealBlockEffect = StateEffect.define<SourceRange | null>({
  map: (range,changes) => range && ({from:changes.mapPos(range.from,-1),to:changes.mapPos(range.to,1)}),
});
/** Explicit completion can return a block opened from reading to the reading view. */
export const blockEditingFinished = Annotation.define<boolean>();
export const rawBlockField = StateField.define<SourceRange | null>({
  create: () => null,
  update(range,transaction) {
    if(range&&transaction.docChanged)range={from:transaction.changes.mapPos(range.from,-1),to:transaction.changes.mapPos(range.to,1)};
    for(const effect of transaction.effects)if(effect.is(revealBlockEffect))range=effect.value;
    if(range&&transaction.selection&&!transaction.state.selection.ranges.every(selection=>selection.from>=range!.from&&selection.to<=range!.to))return null;
    return range;
  },
});

/** Resolve a paragraph/heading/code/table, rather than a wrapped visual line or an entire heading section. */
export function editableBlock(state:EditorState,position:number):SourceRange {
  const at=Math.max(0,Math.min(position,state.doc.length));
  let node=syntaxTree(state).resolveInner(at,at===state.doc.length?-1:1);
  for(;node.parent;node=node.parent) {
    if(/^(?:ATXHeading[1-6]|SetextHeading[12]|Paragraph|FencedCode|CodeBlock|Table|HorizontalRule|HTMLBlock|LinkReference)$/.test(node.name)) {
      const block=node.name==='Paragraph'&&node.parent.name==='ListItem'?node.parent:node;
      return {from:block.from,to:block.to};
    }
  }
  const line=state.doc.lineAt(at);return {from:line.from,to:line.to};
}
export function rawBlockContains(state:EditorState,from:number,to:number) {
  const range=state.field(rawBlockField,false);return !!range&&range.from<=from&&range.to>=to;
}
/** Select the exact source block without changing text, its filename, or undo history. */
export function revealBlock(view:EditorView,position=view.state.selection.main.head) {
  if(view.state.readOnly)return false;
  const range=editableBlock(view.state,position);
  view.dispatch({effects:[revealBlockEffect.of(range),EditorView.scrollIntoView(range.from,{y:'nearest',yMargin:24})],selection:EditorSelection.range(range.from,range.to),userEvent:'select.block'});
  view.focus();return true;
}
export function finishBlock(view:EditorView) {
  if(!view.state.field(rawBlockField))return false;
  view.dispatch({effects:revealBlockEffect.of(null),selection:EditorSelection.cursor(view.state.selection.main.head),annotations:blockEditingFinished.of(true)});
  return true;
}
/** A normal double click selects one complete Markdown block; source mode keeps native word selection. */
export function blockEditingInteractions(doubleClickToEdit:boolean) {
  return [
    Prec.high(keymap.of([{key:'Mod-Enter',run:revealBlock},{key:'Escape',run:finishBlock}])),
    EditorView.domEventHandlers({
      mousedown(event,view) {
        if(!doubleClickToEdit||event.button!==0||event.detail!==2||event.altKey||event.metaKey||event.ctrlKey||event.shiftKey||view.state.readOnly)return false;
        const position=view.posAtCoords({x:event.clientX,y:event.clientY});if(position===null)return false;
        event.preventDefault();return revealBlock(view,position);
      },
      dblclick(event,view) {
        if(!doubleClickToEdit||view.state.readOnly)return false;
        event.preventDefault();
        if(view.state.field(rawBlockField))return true;
        const position=view.posAtCoords({x:event.clientX,y:event.clientY});return position!==null&&revealBlock(view,position);
      },
    }),
  ];
}
