import { t } from '../i18n';
import {browserMode, browserFetch} from './browserStore';
let sessionRequest: Promise<void> | null = null;
/** Obtain a fresh local capability after an offline launch or a backend restart. */
async function refreshSession() {
  if (!sessionRequest) sessionRequest=(async()=>{
    const response=await fetch('/api/session',{headers:{'X-AB-Markdown-Client':'1'},cache:'no-store'});
    if(!response.ok)throw new Error(t("Não foi possível conectar ao aplicativo local."));
    const session=await response.json();window.__MARKDOWN_TOKEN__=session.token;
  })().finally(()=>{sessionRequest=null;});
  await sessionRequest;
}
export async function authorizedFetch(route: string, body?: unknown): Promise<Response> {
  if(browserMode)return browserFetch(route,body);
  if(!window.__MARKDOWN_TOKEN__)await refreshSession();
  const request=()=>fetch(`/api/${route}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${window.__MARKDOWN_TOKEN__}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  let response=await request();
  if(response.status===403){await refreshSession();response=await request();}
  return response;
}
