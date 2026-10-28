import {useCallback,useEffect,useState,type RefObject} from 'react';
import {useNativeWorkspace} from '@/lib/useNativeWorkspace';

/** A portal follows its content pane and never spans a system-reserved division. */
export function useFloatingMenu(trigger:RefObject<HTMLButtonElement|null>,open:boolean,preferredWidth:number,preferredHeight:number,align:'start'|'end'='start') {
 const layout=useNativeWorkspace();
 const [position,setPosition]=useState({left:0,top:0,width:preferredWidth,maxHeight:preferredHeight});
 const place=useCallback(()=>{
  const button=trigger.current;if(!button)return;
  const rect=button.getBoundingClientRect();
  let left=0,top=0,right=innerWidth,bottom=innerHeight;
  if(layout.nativeChrome){
   const scope=button.closest<HTMLElement>('[data-markdown-workbench]')?.getBoundingClientRect();
   if(scope){left=Math.max(left,scope.left);right=Math.min(right,scope.right);top=Math.max(top,scope.top);bottom=Math.min(bottom,scope.bottom);}
   const fold=layout.division;
   if(fold && fold.height>=layout.height*.6){if(rect.left+rect.width/2<fold.x)right=Math.min(right,fold.x);else left=Math.max(left,fold.x+Math.max(12,fold.width));}
   else if(fold && fold.width>=layout.width*.6){if(rect.top+rect.height/2<fold.y)bottom=Math.min(bottom,fold.y);else top=Math.max(top,fold.y+Math.max(12,fold.height));}
  }
  const width=Math.min(preferredWidth,Math.max(44,right-left-16));
  const height=Math.min(preferredHeight,Math.max(44,bottom-top-16));
  const x=Math.max(left+8,Math.min(align==='end'?rect.right-width:rect.left,right-width-8));
  const y=rect.bottom+6+height<=bottom-8?rect.bottom+6:Math.max(top+8,Math.min(rect.top-height-6,bottom-height-8));
  const next={left:x,top:y,width,maxHeight:Math.max(44,bottom-y-8)};
  setPosition(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
 },[trigger,layout,preferredWidth,preferredHeight,align]);
 useEffect(()=>{
  if(!open)return;place();window.addEventListener('resize',place);
  const area=trigger.current?.closest<HTMLElement>('[data-markdown-workbench]');
  const observer=new ResizeObserver(place);if(area)observer.observe(area);
  return()=>{window.removeEventListener('resize',place);observer.disconnect();};
 },[open,place,trigger]);
 return {position,place};
}
