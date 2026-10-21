import { t } from './i18n';
import {useEffect, useRef, useState} from 'react';
import {authorizedFetch} from './lib/session';
interface Props {
  /** Checkout identity prevents reusing an image after switching repositories. */
  repository: string | null;
  /** Safe repository-relative Markdown filename. */
  name: string;
  /** Note revision timestamp invalidates the preview after editing. */
  modifiedAt: string;
}
/** Fetch private image bytes only as the note enters the independently scrolling list. */
export function NoteThumbnail({repository, name, modifiedAt}: Props) {
  const host=useRef<HTMLSpanElement>(null);
  const [source,setSource]=useState("");
  useEffect(()=>{
    let active=true, objectUrl="";
    setSource("");
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      void(async()=>{
        try {
          const response=await authorizedFetch(`thumbnail?name=${encodeURIComponent(name)}`);
          if(!response.ok)return;
          const image=await response.json();if(!image||!active)return;
          const data=Uint8Array.from(atob(image.data),char=>char.charCodeAt(0));
          objectUrl=URL.createObjectURL(new Blob([data],{type:image.mime}));
          setSource(objectUrl);
        }catch { /* Missing/offline images leave the note title and text available. */ }
      })();
    },{rootMargin:'120px'});
    if(host.current)observer.observe(host.current);
    return()=>{active=false;observer.disconnect();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[repository,name,modifiedAt]);
  return <span ref={host} className="note-thumbnail">{source&&<img src={source} width="112" height="62" alt={t("Prévia da imagem da nota")}/>}</span>;
}
