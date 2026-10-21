import names from '../../server/reference-texts.json';
import coverUrl from '../../docs/reference-texts/assets/cover.jpg?url';
import type { Language } from '../i18n';
const sources = import.meta.glob('../../docs/reference-texts/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string,string>;
/** Independent, editable reference files share one portable cover path. */
export async function referenceText(language: Language) {
  const name=names[language],value=sources[`../../docs/reference-texts/${name}`];
  if(!value)throw new Error('Bundled reference text is missing.');
  const response=await fetch(coverUrl);if(!response.ok)throw new Error('Bundled reference cover is unavailable.');
  const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {name,value,files:[{path:'assets/cover.jpg',data:btoa(binary),mime:'image/jpeg'}]};
}
