import { spawn, execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { zipSync, strToU8 } from 'fflate';

/** Capture real simulator pixels and recordings with localized, fictional documents. */
const root = fileURLToPath(new URL('../', import.meta.url));
const [device, category] = process.argv.slice(2);
const categories = ['iphone-medium', 'ipad-13', 'iphone-duo'];
if (!/^[A-F0-9-]{36}$/i.test(device || '') || !categories.includes(category)) {
  throw new Error('Pass an isolated Scriba Store simulator UDID and a supported media category.');
}
const inventory = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf8' }));
const target = Object.values(inventory.devices).flat().find(item => item.udid === device);
if (!target || !/^Scriba (Store|PDF Review) /.test(target.name)) throw new Error('Only an isolated Scriba media/QA simulator is eligible.');
const output = path.resolve(process.env.SCRIBA_MEDIA_OUTPUT || path.join(root, 'artifacts/app-store-media-20261106'));
const derived = process.env.SCRIBA_MEDIA_DERIVED || path.join(root, 'artifacts/store-media-derived');
await fs.mkdir(output, { recursive: true });
const copy = JSON.parse(await fs.readFile(path.join(root, 'docs/app-store/creative-assets/sources/copy.json'), 'utf8'));
const cover = await fs.readFile(path.join(root, 'docs/welcome-texts/assets/boas-vindas.jpg'));
const headings = { 'pt-BR': 'Ideias conectadas', 'en-US': 'Connected ideas', 'de-DE': 'Ideen verbinden', 'fr-FR': 'Relier les idées' };
const references = { 'pt-BR': 'Referências', 'en-US': 'References', 'de-DE': 'Referenzen', 'fr-FR': 'Références' };
const nextSteps = { 'pt-BR': 'Próximos passos', 'en-US': 'Next steps', 'de-DE': 'Nächste Schritte', 'fr-FR': 'Prochaines étapes' };
const diagramNames = { 'pt-BR': 'Diagrama.md', 'en-US': 'Diagram.md', 'de-DE': 'Diagramm.md', 'fr-FR': 'Diagramme.md' };

function scene(nodes) {
  const common = { angle: 0, strokeColor: '#183d52', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null, version: 1, isDeleted: false, boundElements: [], updated: 1, link: null, locked: false };
  const elements = nodes.flatMap((label, index) => {
    const y = 40 + index * 190;
    const text = label.replace(/\\n/g, '\n');
    return [
      { ...common, id: `node-${index}`, type: 'rectangle', seed: index + 10, versionNonce: index + 10, x: 40, y, width: 300, height: 120, roundness: { type: 3 }, backgroundColor: ['#fff4df', '#d4e8f0', '#ffd8aa'][index] },
      { ...common, id: `label-${index}`, type: 'text', seed: index + 30, versionNonce: index + 30, x: 60, y: y + 25, width: 260, height: 70, backgroundColor: 'transparent', fontSize: 28, fontFamily: 1, text, originalText: text, textAlign: 'center', verticalAlign: 'middle', containerId: null, autoResize: false, lineHeight: 1.25 },
      ...(index < nodes.length - 1 ? [{ ...common, id: `arrow-${index}`, type: 'arrow', seed: index + 50, versionNonce: index + 50, x: 190, y: y + 125, width: 0, height: 60, points: [[0, 0], [0, 60]], startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: 'arrow', elbowed: false, backgroundColor: 'transparent' }] : []),
    ];
  });
  return JSON.stringify({ type: 'excalidraw', version: 2, source: 'Scriba', elements, appState: { viewBackgroundColor: '#ffffff' }, files: {} });
}

const catalog = [];
for (const [locale, content] of Object.entries(copy)) {
  if (process.env.SCRIBA_MEDIA_LOCALE && process.env.SCRIBA_MEDIA_LOCALE !== locale) continue;
  const translations = content.language === 'pt' ? {} : JSON.parse(await fs.readFile(path.join(root, `src/i18n/${content.language}.json`), 'utf8'));
  const translate = text => translations[text] || text;
  const note = `# ${content.title}\n\n${content.intro}\n\n![Scriba](assets/cover.jpg)\n\n## ${content.chapter}\n\n- [x] ${content.tasks[0]}\n- [ ] ${content.tasks[1]}\n- [ ] ${content.tasks[2]}\n\n## ${references[locale]}\n\n${content.intro}\n\n## ${nextSteps[locale]}\n\n${content.closing}\n`;
  const diagram = `# ${headings[locale]}\n\n${content.intro}\n\n\`\`\`mermaid\nflowchart TD\n  A["${content.nodes[0]}"] --> B["${content.nodes[1]}"]\n  B --> C["${content.nodes[2].replace(/\\n/g, ' ')}"]\n\`\`\`\n\n## ${content.chapter}\n\n- ${content.tasks.join('\n- ')}\n`;
  const boardTitle = content.draw.join(' ');
  catalog.push({
    locale, language: content.language,
    labels: { formatting: translate('Formatação'), openWhiteboard: translate('Abrir whiteboard'), backToNote: translate('Voltar à nota'), more: translate('Mais opções da nota'), read: translate('Ler') },
    note: { heading: content.title, name: content.noteName.replace(/\.md$/, '.zip'), zip: Buffer.from(zipSync({ 'text.md': strToU8(note), 'assets/cover.jpg': cover })).toString('base64') },
    diagram: { heading: headings[locale], name: diagramNames[locale], source: diagram },
    board: { heading: boardTitle, name: content.boardName, whiteboard: true, source: `# ${boardTitle}\n\n\`\`\`excalidraw\n${scene(content.nodes)}\n\`\`\`\n` },
  });
}

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (target.state !== 'Booted') run('xcrun', ['simctl', 'boot', device]);
run('xcrun', ['simctl', 'bootstatus', device, '-b']);
run('xcrun', ['simctl', 'status_bar', device, 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100', '--wifiMode', 'active', '--wifiBars', '3', '--cellularMode', 'active', '--cellularBars', '4']);
const stamp = Date.now();
const logFile = path.join(output, `${category}-${stamp}.log`);
const log = await fs.open(logFile, 'w');
const test = spawn('xcodebuild', [
  '-project', 'ios/App/App.xcodeproj', '-scheme', 'Scriba',
  '-destination', `platform=iOS Simulator,id=${device}`, '-derivedDataPath', derived,
  '-resultBundlePath', path.join(output, `${category}-${stamp}.xcresult`),
  '-parallel-testing-enabled', 'NO', '-only-testing:ScribaTests/ScribaTests/testLocalizedStoreMedia',
  'CODE_SIGNING_ALLOWED=NO', 'test',
], { cwd: root, stdio: ['ignore', log.fd, log.fd] });
let finished = false, exitCode, documentDirectory, recorder, recorderExit, lastId = '';
const result = [];
test.on('exit', code => { finished = true; exitCode = code; });
const stopCapture = () => {
  recorder?.kill('SIGINT');
  test.kill('SIGTERM');
};
process.once('SIGINT', stopCapture);
process.once('SIGTERM', stopCapture);
try {
  for (let attempt = 0; attempt < 9000 && !finished; attempt++) {
    try {
      const container = run('xcrun', ['simctl', 'get_app_container', device, 'com.aeonbridge.scriba', 'data']).trim();
      const directory = path.join(container, 'Documents');
      if (directory !== documentDirectory) {
        documentDirectory = directory;
        await fs.mkdir(directory, { recursive: true });
        for (const name of ['store-capture-request.json', 'store-capture-ack.json']) await fs.rm(path.join(directory, name), { force: true });
        await fs.writeFile(path.join(directory, 'store-capture-catalog.json'), JSON.stringify(catalog));
      }
    } catch { await pause(200); continue; }
    const request = await fs.readFile(path.join(documentDirectory, 'store-capture-request.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (!request || request.id === lastId) { await pause(150); continue; }
    lastId = request.id;
    const destination = path.join(output, category, request.locale);
    await fs.mkdir(destination, { recursive: true });
    if (request.kind === 'screenshot') {
      const file = path.join(destination, `${request.label}.png`);
      run('xcrun', ['simctl', 'io', device, 'screenshot', '--type=png', file]);
      result.push({ ...request, category, file, device: target.name, deviceType: target.deviceTypeIdentifier });
      console.log(`Captured ${category}/${request.locale}/${request.label}`);
    } else if (request.kind === 'videoStart') {
      const file = path.join(destination, 'workflow-raw.mp4');
      recorder = spawn('xcrun', ['simctl', 'io', device, 'recordVideo', '--codec=h264', '--force', file], { stdio: ['ignore', log.fd, log.fd] });
      recorderExit = new Promise(resolve => recorder.once('exit', resolve));
      await pause(1000);
      if (recorder.exitCode !== null) throw new Error('Simulator recording failed.');
      result.push({ ...request, category, file, device: target.name, deviceType: target.deviceTypeIdentifier });
    } else if (request.kind === 'videoStop') {
      recorder.kill('SIGINT');
      await recorderExit;
      recorder = null;
      console.log(`Recorded ${category}/${request.locale}/workflow`);
    }
    await fs.writeFile(path.join(documentDirectory, 'store-capture-ack.tmp'), JSON.stringify({ id: request.id }));
    await fs.rename(path.join(documentDirectory, 'store-capture-ack.tmp'), path.join(documentDirectory, 'store-capture-ack.json'));
    if (request.kind === 'finish') break;
  }
  while (!finished) await pause(250);
  if (exitCode !== 0) throw new Error(`Native media session failed (${exitCode}). Inspect ${logFile}.`);
  if (result.filter(item => item.kind === 'screenshot').length !== catalog.length * 6 || result.filter(item => item.kind === 'videoStart').length !== catalog.length) {
    throw new Error(`Incomplete capture session. Inspect ${logFile}.`);
  }
  await fs.writeFile(path.join(output, `${category}-manifest.json`), JSON.stringify({ device, deviceName: target.name, category, source: 'Actual iOS simulator screenshots and screen recordings, fictional localized documents', captures: result }, null, 2) + '\n');
} finally {
  recorder?.kill('SIGINT');
  if (!finished) test.kill('SIGTERM');
  process.off('SIGINT', stopCapture);
  process.off('SIGTERM', stopCapture);
  if (documentDirectory) await fs.rm(path.join(documentDirectory, 'store-capture-catalog.json'), { force: true });
  await log.close();
}
