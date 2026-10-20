import pdfMake from 'pdfmake/build/pdfmake';
import fonts from 'pdfmake/build/vfs_fonts';
import courier from 'pdfmake/build/standard-fonts/Courier';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { PdfJob, PdfReply } from './pdfTypes';

pdfMake.addVirtualFileSystem(fonts);
pdfMake.addFontContainer(courier);
const scope = globalThis as unknown as {
  /** A dedicated, export-only worker keeps long document layout off the editor thread. */
  onmessage: (event: MessageEvent<PdfJob>) => void;
  postMessage: (reply: PdfReply, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data: job }) => {
  try {
    const { palette } = job;
    pdfMake.addTableLayouts({ scribaTable: { hLineWidth: () => .4, vLineWidth: () => 0, hLineColor: () => palette.border, paddingLeft: () => 6, paddingRight: () => 6 } });
    const definition: TDocumentDefinitions = {
      pageSize: 'A4', pageMargins: [42, 42, 42, 58],
      info: { title: job.title, creator: 'Scriba Markdown Editor' },
      defaultStyle: { font: 'Roboto', fontSize: 11, color: palette.text, lineHeight: 1.35 },
      styles: {
        paragraph: { margin: [0, 0, 0, 11], alignment: 'justify' },
        h1: { fontSize: 24, bold: true, color: palette.heading, margin: [0, 0, 0, 20] },
        h2: { fontSize: 18, bold: true, color: palette.heading, margin: [0, 16, 0, 11] },
        h3: { fontSize: 14, bold: true, color: palette.heading, margin: [0, 12, 0, 8] },
        h4: { fontSize: 12, bold: true, color: palette.heading, margin: [0, 10, 0, 6] },
        code: { font: 'Courier', fontSize: 9, lineHeight: 1.25, color: palette.text },
        inlineCode: { font: 'Courier', fontSize: 10, background: palette.code },
        caption: { fontSize: 9, color: palette.muted, margin: [0, 4, 0, 11] },
        scribaFooter: { fontSize: 8, color: palette.muted },
      },
      content: job.content.length ? job.content : [{ text: ' ' }],
      footer: (page, count): Content => ({ style: 'scribaFooter', margin: [42, 9, 42, 0], stack: [
        { style: 'scribaFooter', canvas: [{ type: 'line', x1: 0, y1: 0, x2: 511.28, y2: 0, lineWidth: .4, lineColor: palette.border }], margin: [0, 0, 0, 7] },
        { style: 'scribaFooter', columns: [
          { style: 'scribaFooter', image: job.logo, width: 13, height: 13, margin: [0, 0, 7, 0] },
          { style: 'scribaFooter', text: 'scriba markdown editor - powered by Aeon Bridge Co.', fontSize: 8, color: palette.muted, margin: [0, 2, 0, 0], width: '*' },
          { style: 'scribaFooter', text: `${page} / ${count}`, width: 36, alignment: 'right', fontSize: 8, color: palette.muted, margin: [0, 2, 0, 0] },
        ], columnGap: 5 },
      ] }),
      // Footer nodes also appear in pdfmake's following-node list; they cannot keep a heading with its body.
      pageBreakBefore: (node, queries) => !!node.headlineLevel && !queries.getFollowingNodesOnPage().some(next => next.style !== 'scribaFooter' && !next.headlineLevel),
    };
    const bytes = Uint8Array.from(await pdfMake.createPdf(definition).getBuffer()).buffer;
    if (bytes.byteLength > 60 * 1024 * 1024) throw new Error('O PDF excede 60 MB. Exporte uma seção menor ou reduza as imagens.');
    scope.postMessage({ bytes }, [bytes]);
  } catch (cause) { scope.postMessage({ error: cause instanceof Error ? cause.message : 'Não foi possível gerar o PDF.' }); }
};
