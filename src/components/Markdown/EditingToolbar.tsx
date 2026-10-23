import {t} from '../../i18n';
import {Bold,Italic,Strikethrough,Code,Braces,Quote,List,ListOrdered,ListChecks,Minus,Table2,Link,ImagePlus,Undo2,Redo2,IndentIncrease,IndentDecrease,Superscript,SquareCode,Check,PenTool,Shapes,MoreVertical,ChevronDown,EyeOff} from 'lucide-react';
import {HeadingPicker} from './HeadingPicker';
import {FormattingMenu} from './FormattingMenu';
import type {MarkdownCommand} from './editorCommands';
import styles from './MarkdownWorkbench.module.css';

/** Frequent writing actions share one quiet row; less frequent actions retain labeled menus. */
export function EditingToolbar({disabled,onCommand,onLink,onImage,onExcalidraw,onIcon,onEditBlock,onHide,blockEditing=false}:{onHide?:()=>void;onIcon?:()=>void;onExcalidraw?:()=>void;onEditBlock?:()=>void;blockEditing?:boolean;disabled:boolean;onCommand:(command:MarkdownCommand)=>void;onLink:()=>void;onImage:()=>void}) {
 const lists=[{command:'bullet',label:t('Lista'),Icon:List},{command:'ordered',label:t('Lista numerada'),Icon:ListOrdered},{command:'indent',label:t('Aumentar recuo'),Icon:IndentIncrease},{command:'outdent',label:t('Diminuir recuo'),Icon:IndentDecrease}] as const;
 const more=[{command:'code',label:t('Código inline'),Icon:Code},{command:'codeblock',label:t('Bloco de código'),Icon:Braces},{command:'quote',label:t('Citação'),Icon:Quote}] as const;
 const item=({command,label,Icon}:(typeof lists)[number]|(typeof more)[number])=><button key={command} data-menu-item role="menuitem" type="button" disabled={disabled} onClick={()=>onCommand(command)}><Icon size={17}/><span>{label}</span></button>;
 const action=(label:string,Icon:typeof Bold,run:()=>void,secondary=false)=><button className={secondary?styles.secondaryFormatAction:undefined} type="button" disabled={disabled} aria-label={label} title={label} onMouseDown={event=>event.preventDefault()} onClick={run}><Icon size={17}/></button>;
 return <div className={`${styles.editingToolbar} ${styles.cleanFormatting}`} data-ui="toolbar" role="toolbar" aria-label={t('Ferramentas de edição')}>
  <HeadingPicker compact disabled={disabled} onCommand={onCommand}/>
  {action(t('Tarefas'),ListChecks,()=>onCommand('task'))}
  <FormattingMenu label={t('Listas')} icon={<><List size={17}/><ChevronDown size={12}/></>} disabled={disabled}>{lists.map(item)}</FormattingMenu>
  <span className={styles.formatSeparator} aria-hidden="true"/>
  {action(t('Negrito'),Bold,()=>onCommand('bold'))}{action(t('Itálico'),Italic,()=>onCommand('italic'))}{action(t('Tachado'),Strikethrough,()=>onCommand('strike'))}{action(t('Inserir referência'),Superscript,()=>onCommand('footnote'))}
  {action(t('Inserir link'),Link,onLink)}{action(t('Inserir tabela'),Table2,()=>onCommand('table'),true)}{action(t('Imagem'),ImagePlus,onImage,true)}
  {action(t('Separador'),Minus,()=>onCommand('rule'))}{action(t('Desfazer'),Undo2,()=>onCommand('undo'))}{action(t('Refazer'),Redo2,()=>onCommand('redo'))}{onIcon&&action(t('Galeria de ícones'),Shapes,onIcon)}
  <FormattingMenu label={t('Mais opções de formatação')} icon={<MoreVertical size={18}/>} disabled={disabled}>
   {more.map(item)}
   <div className={styles.formatMenuSection}>
    <button data-menu-item role="menuitem" type="button" disabled={disabled} onClick={()=>onCommand('table')}><Table2 size={17}/>{t('Inserir tabela')}</button>
    <button data-menu-item role="menuitem" type="button" disabled={disabled} onClick={onImage}><ImagePlus size={17}/>{t('Imagem')}</button>
    {onExcalidraw&&<button data-menu-item role="menuitem" type="button" onClick={onExcalidraw}><PenTool size={17}/>{t('Inserir desenho Excalidraw')}</button>}
    {onEditBlock&&<button data-menu-item role="menuitem" type="button" onClick={onEditBlock}>{blockEditing?<Check size={17}/>:<SquareCode size={17}/>} {blockEditing?t('Concluir edição do bloco'):t('Editar bloco como Markdown')}</button>}
   </div>
   {onHide&&<div className={styles.formatMenuSection}><button data-menu-item role="menuitem" type="button" onClick={onHide}><EyeOff size={17}/>{t('Ocultar formatação')}</button></div>}
  </FormattingMenu>
 </div>;
}
