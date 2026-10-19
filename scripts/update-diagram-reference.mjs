import { promises as fs } from 'node:fs';

// Only measured compatibility text is generated; authored prose and Mermaid stay editable.
const file=new URL('../docs/Scriba-Diagramas.md',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('../docs/evidence/diagram-reference/compatibility.json',import.meta.url),'utf8'));
let markdown=await fs.readFile(file,'utf8');
const examples=[...markdown.matchAll(/<!-- diagram-example: ([\w-]+) family=(\w+) -->[\s\S]*?```mermaid\n([\s\S]*?)```/g)];
if(examples.length!==report.examples.length)throw new Error('Re-run the complete browser corpus before publishing compatibility.');
const engines={mermaid:'Mermaid',pele:'Pele',beautiful:'Beautiful Mermaid'};
const families=new Map();
for(const match of examples) {
  const example=report.examples.find(item=>item.id===match[1]);
  if(!example||example.source!==match[3]||example.results.mermaid.state!=='ready')throw new Error(`Missing or stale default rendering: ${match[1]}`);
  const supported=Object.keys(engines).filter(engine=>example.results[engine].state==='ready');
  const unsupported=Object.keys(engines).filter(engine=>example.results[engine].state!=='ready');
  const label=`**Motores verificados:** ${supported.map(engine=>engines[engine]).join(' · ')}.${unsupported.length?` ${unsupported.map(engine=>engines[engine]).join(' e ')} não renderiza este exemplo.`:''}`;
  const id=example.id;
  const pattern=new RegExp(`(<!-- diagram-example: ${id} family=\\w+ -->\\n)<!-- example-compatibility: [^>]* -->[\\s\\S]*?(?=\x60\x60\x60mermaid)`);
  markdown=markdown.replace(pattern,`$1<!-- example-compatibility: ${id} -->\n${label}\n\n`);
  if(!families.has(example.family))families.set(example.family,[]);families.get(example.family).push(example);
}
const labels={flowchart:'Fluxogramas e formas',swimlane:'Raias',usecase:'Casos de uso',journey:'Jornada',sequence:'Sequência',state:'Estados',er:'Entidade e relacionamento',class:'Classes',requirement:'Requisitos',mindmap:'Mapa mental',treeView:'Árvore',railroad:'Railroad, EBNF, ABNF e PEG',block:'Blocos',architecture:'Arquitetura',c4:'C4: contexto a implantação',packet:'Pacotes',agentflow:'Fluxo de agentes',gantt:'Gantt',timeline:'Linha do tempo',kanban:'Kanban',gitGraph:'Histórico Git',pie:'Pizza',quadrantChart:'Quadrantes',xychart:'XY: barras, linha e combinado',radar:'Radar',sankey:'Sankey',treemap:'Treemap',venn:'Venn',eventmodeling:'Modelagem de eventos',ishikawa:'Ishikawa',wardley:'Wardley',cynefin:'Cynefin',info:'Diagnóstico (info)'};
const cell=(items,engine)=>{const count=items.filter(item=>item.results[engine].state==='ready').length;return count===items.length?`Sim (${count}/${items.length})`:count?`Parcial (${count}/${items.length})`:'Não';};
const rows=[...families].map(([family,items])=>`| ${labels[family]||family} | ${items.length} | ${cell(items,'mermaid')} | ${cell(items,'pele')} | ${cell(items,'beautiful')} |`);
const count=engine=>report.examples.filter(item=>item.results[engine].state==='ready').length;
const testedDate=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(report.testedAt));
const matrix=`Verificado no próprio Scriba em **${testedDate}**: **${examples.length} exemplos**, agrupados em **${families.size} famílias**, incluindo o diagnóstico \x60info\x60. Mermaid ${report.engines.mermaid}: **${count('mermaid')}/${examples.length}**; Pele ${report.engines.pele}: **${count('pele')}/${examples.length}**; Beautiful Mermaid ${report.engines.beautiful}: **${count('beautiful')}/${examples.length}**.\n\n| Família / variação | Exemplos | Mermaid | Pele | Beautiful Mermaid |\n| --- | ---: | --- | --- | --- |\n${rows.join('\n')}\n\n“Sim” significa que os exemplos renderizaram como SVG no aplicativo. Não garante equivalência de formas, posicionamento ou tipografia entre motores, nem todas as combinações de uma gramática. Os testes mantêm o código original e verificam que a troca de motor não grava alterações na nota.\n`;
markdown=markdown.replace(/<!-- compatibility:start -->[\s\S]*?<!-- compatibility:end -->/,`<!-- compatibility:start -->\n${matrix}<!-- compatibility:end -->`);
await fs.writeFile(file,markdown);
console.log(`Updated ${examples.length} observations and ${families.size} families without changing diagram source.`);
