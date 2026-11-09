import type { Content, ContentText } from 'pdfmake/interfaces';

export interface PdfMathText extends ContentText {
  /** Export-only annotation. The fallback text retains unsupported TeX verbatim. */
  scribaMath: { tex: string; display: boolean };
}

export interface PdfPalette {
  /** Resolved light reading tokens, independent of the current screen theme. */
  text: string;
  heading: string;
  muted: string;
  border: string;
  stripe: string;
  link: string;
  code: string;
}
export interface PdfJob {
  language?: import("../../i18n").Language;
  /** Plain, serializable content; the worker never receives Markdown or asset handles. */
  content: Content[];
  /** Document metadata uses the first heading or the export filename. */
  title: string;
  /** Embedded application logo; no external image requests occur during layout. */
  logo: string;
  /** Shared print colors resolved by the caller. */
  palette: PdfPalette;
}
export type PdfReply = { bytes: ArrayBuffer } | { error: string };
