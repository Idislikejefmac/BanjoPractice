// F32 printable tab (DEVELOPMENT.md F32): the song's lines (tab, and optionally the
// notation) laid out on Letter or A4 pages as a PDF, shared through the share sheet.
// Uses jsPDF + svg2pdf.js, never window.print() (unreliable in Home Screen apps). Loaded on
// demand, so it isn't in the app's startup bundle.

import { jsPDF } from "jspdf";
import "svg2pdf.js";

export type Paper = "letter" | "a4";

const STYLE_PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "text-anchor",
  "dominant-baseline",
  "opacity",
  "paint-order",
] as const;

/** A copy of an on-screen SVG with its CSS styles written inline (svg2pdf reads attributes). */
function inlineStyled(svg: SVGSVGElement): SVGSVGElement {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...svg.querySelectorAll("*")];
  const dst = [copy, ...copy.querySelectorAll("*")];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const target = dst[i] as SVGElement;
    for (const prop of STYLE_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v) target.style.setProperty(prop, v);
    }
    // Transparent highlight boxes stay invisible on paper.
    if (el.classList.contains("tab-measure") && !el.classList.contains("current")) {
      target.setAttribute("fill", "none");
    }
  });
  const r = svg.getBoundingClientRect();
  copy.setAttribute("width", String(r.width));
  copy.setAttribute("height", String(r.height));
  if (!copy.getAttribute("viewBox")) copy.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
  return copy;
}

export interface PrintOptions {
  readonly title: string;
  readonly subtitle: string;
  readonly paper: Paper;
  readonly withNotation: boolean;
}

/** Builds the PDF from the song lines currently on screen. */
export async function printTab(lines: readonly HTMLElement[], opts: PrintOptions): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: opts.paper, orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usable = pageW - margin * 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(opts.title, margin, margin + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(opts.subtitle, margin, margin + 22);
  let y = margin + 38;

  for (const line of lines) {
    const svgs = [
      ...line.querySelectorAll<SVGSVGElement>(":scope > .notation svg, :scope > svg.tab"),
    ].filter((s) => opts.withNotation || s.classList.contains("tab"));
    // Keep a line's notation and tab on the same page.
    const sizes = svgs.map((s) => {
      const r = s.getBoundingClientRect();
      const scale = usable / Math.max(1, r.width);
      return { svg: s, w: usable, h: r.height * scale };
    });
    const total = sizes.reduce((n, s) => n + s.h, 0) + 10;
    if (y + total > pageH - margin && y > margin + 40) {
      doc.addPage();
      y = margin;
    }
    for (const s of sizes) {
      await doc.svg(inlineStyled(s.svg), { x: margin, y, width: s.w, height: s.h });
      y += s.h;
    }
    y += 10;
  }
  return doc.output("blob");
}
