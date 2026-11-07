import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {navigateActionMenu} from '../ui/actionMenu';
import styles from './MarkdownWorkbench.module.css';
import {useFloatingMenu} from './useFloatingMenu';

/** Portal placement keeps compact formatting menus outside the editor's clipped scroll area. */
export function FormattingMenu({label,icon,disabled,children}:{label:string;icon:ReactNode;disabled:boolean;children:ReactNode}) {
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId();
 const {position,place}=useFloatingMenu(trigger,open,270,360,'end');
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const toggle=()=>{place();setOpen(value=>!value);};
 return <div ref={root} className={styles.formatMenuTrigger}><button ref={trigger} type="button" disabled={disabled} title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onMouseDown={event=>event.preventDefault()} onClick={toggle} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();if(!open)toggle();requestAnimationFrame(()=>menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());}}}>{icon}</button>{open&&createPortal(<div ref={menu} id={id} data-ui="action-menu" role="menu" aria-label={label} className={`${styles.headingMenu} ${styles.formatMenu}`} style={position} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}else navigateActionMenu(event);}} onMouseDown={event=>event.preventDefault()} onClick={event=>{if((event.target as Element).closest('button'))setOpen(false);}}>{children}</div>,document.body)}</div>;
}
