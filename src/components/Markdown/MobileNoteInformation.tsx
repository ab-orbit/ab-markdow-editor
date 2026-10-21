import { useId, useState, type ComponentProps } from 'react';
import { BarChart3, ListTree, MessageSquare, CaseSensitive, Pilcrow, Clock, CalendarDays } from 'lucide-react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { currentLocale, t } from '../../i18n';
import { EditorDialog } from './EditorDialog';
import { DocumentOutline } from './DocumentOutline';
import styles from './MarkdownWorkbench.module.css';
const parser=unified().use(remarkParse).use(remarkGfm);
/** Statistics and navigation share a compact mobile sheet; document source is never changed. */
export function MobileNoteInformation({source,words,createdAt,modifiedAt,outline,onClose}:{source:string;words:number;createdAt?:string;modifiedAt?:string;outline:Omit<ComponentProps<typeof DocumentOutline>,'source'|'id'|'onClose'>;onClose:()=>void}){
 const [tab,setTab]=useState<'statistics'|'outline'>('statistics'),id=useId();
 let paragraphs=0;function count(node:{type:string;children?:unknown[]}){if(node.type==='paragraph')paragraphs++;node.children?.forEach(child=>count(child as typeof node));}count(parser.parse(source));
 const formatDate=(value?:string)=>value&&!Number.isNaN(Date.parse(value))?new Intl.DateTimeFormat(currentLocale(),{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):t('Não disponível');
 const cards=[{value:words,label:t('Palavras'),icon:MessageSquare},{value:source.length,label:t('Caracteres'),icon:CaseSensitive},{value:paragraphs,label:t('Parágrafos'),icon:Pilcrow},{value:`${Math.ceil(words/250)} ${t('min')}`,label:t('Tempo de leitura'),icon:Clock}];
 const title=tab==='statistics'?t('Estatísticas'):t('Índice');
 return <EditorDialog title={title} className={styles.noteInformation} dismissOnOutside onClose={onClose}>
  <div role="tablist" aria-label={t('Informações da nota')} className={styles.informationTabs} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'statistics':event.key==='End'?'outline':tab==='statistics'?'outline':'statistics';setTab(next);event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();}}>
   <button type="button" role="tab" data-tab="statistics" aria-selected={tab==='statistics'} aria-label={t('Estatísticas')} aria-controls={`${id}-statistics`} id={`${id}-statistics-tab`} tabIndex={tab==='statistics'?0:-1} onClick={()=>setTab('statistics')}><BarChart3 size={18}/></button>
   <button type="button" role="tab" data-tab="outline" aria-selected={tab==='outline'} aria-label={t('Índice')} aria-controls={`${id}-outline`} id={`${id}-outline-tab`} tabIndex={tab==='outline'?0:-1} onClick={()=>setTab('outline')}><ListTree size={18}/></button>
  </div>
  {tab==='statistics'?<div role="tabpanel" id={`${id}-statistics`} aria-labelledby={`${id}-statistics-tab`} className={styles.informationStatistics}>
   <div className={styles.informationCards}>{cards.map(({value,label,icon:Icon})=><div key={label}><Icon size={17} aria-hidden="true"/><strong>{typeof value==='number'?value.toLocaleString(currentLocale()):value}</strong><span>{label}</span></div>)}</div>
   <dl className={styles.informationDates}>{[[t('Modificado'),modifiedAt],[t('Criado'),createdAt]].map(([label,value])=><div key={label}><CalendarDays size={16} aria-hidden="true"/><dd>{formatDate(value)}</dd><dt>{label}</dt></div>)}</dl>
  </div>:<div role="tabpanel" id={`${id}-outline`} aria-labelledby={`${id}-outline-tab`} className={styles.informationOutline}><DocumentOutline {...outline} embedded source={source} id={`${id}-headings`} onClose={onClose}/></div>}
 </EditorDialog>;
}
