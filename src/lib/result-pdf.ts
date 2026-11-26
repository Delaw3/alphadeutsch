/**
 * Dependency-free PDF writer for the result slip.
 *
 * The app ships to the web and to a Capacitor WebView, so adding a PDF library
 * (and its fonts) was avoided: this module emits a minimal, valid PDF 1.4 with
 * the base-14 Helvetica fonts, vector rules and JPEG images passed through with
 * `/DCTDecode` (no re-compression). Output is an A4 single page.
 */

export type ResultPdfImage = {
  /** Raw JPEG bytes. */
  bytes: Uint8Array;
  width: number;
  height: number;
};

export type ResultPdfRow = {
  label: string;
  score: number | null;
  grade: string | null;
};

export type ResultPdfModel = {
  studentName: string;
  regNo: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  placeOfBirth: string | null;
  courseTitle: string;
  sittingLabel: string;
  rows: ResultPdfRow[];
  totalScore: number | null;
  /** Denominator for the total row: 100 on the standard scale. */
  maxTotal: number;
  /** Highest mark per skill on the row's scale (25 normally, 100 for %-marked courses). */
  scoreMax: number;
  remark: string | null;
  issuedAt: string | null;
  logo?: ResultPdfImage | null;
  photo?: ResultPdfImage | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const RIGHT = PAGE_WIDTH - MARGIN;

/** Latin-1 characters that need an explicit WinAnsi byte. */
const WIN_ANSI: Record<string, number> = {
  ä: 0xe4,
  ö: 0xf6,
  ü: 0xfc,
  ß: 0xdf,
  Ä: 0xc4,
  Ö: 0xd6,
  Ü: 0xdc,
  é: 0xe9,
  è: 0xe8,
  ê: 0xea,
  á: 0xe1,
  à: 0xe0,
  ç: 0xe7,
  ñ: 0xf1,
  "–": 0x96,
  "—": 0x97,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "·": 0xb7,
};

function pdfString(value: string): string {
  let out = "";
  for (const character of value) {
    const mapped = WIN_ANSI[character];
    const code = mapped ?? character.charCodeAt(0);
    const byte = code > 255 ? 0x3f /* ? */ : code;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += "\\" + String.fromCharCode(byte); // ( ) \
    } else if (byte < 32) {
      out += " ";
    } else {
      out += String.fromCharCode(byte);
    }
  }
  return out;
}

function latin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const chunk of chunks) length += chunk.length;
  const out = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

function scoreText(value: number | null): string {
  if (value === null) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function textWidth(value: string, size: number, bold: boolean): number {
  return value.length * size * (bold ? 0.56 : 0.5);
}

/** Assembles numbered objects, the xref table and the trailer. */
function serialize(objects: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [];
  let offset = 0;
  const push = (chunk: Uint8Array) => {
    parts.push(chunk);
    offset += chunk.length;
  };

  push(latin1("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));

  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(offset);
    push(latin1(`${index + 1} 0 obj\n`));
    push(body);
    push(latin1("\nendobj\n"));
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const entry of offsets) {
    xref += `${String(entry).padStart(10, "0")} 00000 n \n`;
  }
  xref +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;
  push(latin1(xref));

  return concat(parts);
}

/** Builds the single-page A4 result slip. */
export function buildResultPdf(model: ResultPdfModel): Uint8Array {
  const ops: string[] = [];
  const images: { name: string; image: ResultPdfImage }[] = [];

  const text = (value: string, x: number, y: number, size: number, bold = false, gray = 0.12) => {
    if (!value) return;
    ops.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${gray} g 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfString(value)}) Tj ET`,
    );
  };
  const textRight = (value: string, right: number, y: number, size: number, bold = false, gray = 0.12) => {
    text(value, right - textWidth(value, size, bold), y, size, bold, gray);
  };
  const textCenter = (value: string, center: number, y: number, size: number, bold = false, gray = 0.12) => {
    text(value, center - textWidth(value, size, bold) / 2, y, size, bold, gray);
  };
  const rule = (x1: number, y: number, x2: number, width = 1, gray = 0.85) => {
    ops.push(`${gray} G ${width} w ${x1} ${y} m ${x2} ${y} l S`);
  };
  const fill = (x: number, y: number, w: number, h: number, gray: number) => {
    ops.push(`${gray} g ${x} ${y} ${w} ${h} re f`);
  };
  const strokeBox = (x: number, y: number, w: number, h: number, gray = 0.8, width = 1) => {
    ops.push(`${gray} G ${width} w ${x} ${y} ${w} ${h} re S`);
  };
  const hLine = (x1: number, x2: number, y: number, gray = 0.85, width = 0.8) => {
    ops.push(`${gray} G ${width} w ${x1} ${y} m ${x2} ${y} l S`);
  };
  const vLine = (x: number, y1: number, y2: number, gray = 0.85, width = 0.8) => {
    ops.push(`${gray} G ${width} w ${x} ${y1} m ${x} ${y2} l S`);
  };
  const placeImage = (image: ResultPdfImage, x: number, y: number, w: number, h: number) => {
    const name = `Im${images.length + 1}`;
    images.push({ name, image });
    ops.push(`q ${w} 0 0 ${h} ${x} ${y} cm /${name} Do Q`);
  };

  // Watermark first so every later element sits on top of it.
  ops.push(
    "q 0.7071 0.7071 -0.7071 0.7071 118 300 cm BT /F2 52 Tf 0.94 g (ALPHA DEUTSCH) Tj ET Q",
  );

  /* ---------------------------------------------------------------- header */
  if (model.logo) {
    placeImage(model.logo, MARGIN, 742, 56, 56);
  }
  const brandX = model.logo ? MARGIN + 68 : MARGIN;
  text("Alpha Deutsch", brandX, 782, 19, true);
  text("German language school · Awka", brandX, 766, 8.5, false, 0.42);
  textRight("RESULT SLIP", RIGHT, 782, 9, true, 0.42);
  textRight(`Reg. No.: ${model.regNo}`, RIGHT, 766, 10, true);
  rule(MARGIN, 730, RIGHT);

  /* -------------------------------------------------------------- identity */
  const photoW = 92;
  const photoH = 115;
  const photoX = MARGIN;
  const photoY = 590;

  if (model.photo && model.photo.width > 0 && model.photo.height > 0) {
    // Fit inside the frame instead of stretching: scale by the smaller ratio and
    // centre the result, with a light letterbox behind it.
    const scale = Math.min(photoW / model.photo.width, photoH / model.photo.height);
    const drawW = model.photo.width * scale;
    const drawH = model.photo.height * scale;
    fill(photoX, photoY, photoW, photoH, 0.97);
    placeImage(
      model.photo,
      photoX + (photoW - drawW) / 2,
      photoY + (photoH - drawH) / 2,
      drawW,
      drawH,
    );
    strokeBox(photoX, photoY, photoW, photoH, 0.88, 0.8);
  } else {
    fill(photoX, photoY, photoW, photoH, 0.95);
    const initials =
      model.studentName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("") || "AD";
    textCenter(initials, photoX + photoW / 2, photoY + photoH / 2 - 8, 26, true, 0.55);
  }

  const infoX = photoX + photoW + 18;
  text(model.studentName, infoX, 690, 13, true);
  if (model.email) text(model.email, infoX, 674, 9, false, 0.35);
  if (model.phone) text(model.phone, infoX, 660, 9, false, 0.35);
  text(`Date of Birth: ${model.dob ?? "-"}`, infoX, 642, 9, false, 0.3);
  text(`Place of Birth: ${model.placeOfBirth ?? "-"}`, infoX, 628, 9, false, 0.3);

  textRight("COURSE", RIGHT, 690, 8, true, 0.45);
  textRight(model.courseTitle || "-", RIGHT, 674, 12, true);
  if (model.issuedAt) textRight(`Issued: ${model.issuedAt}`, RIGHT, 658, 8.5, false, 0.45);

  rule(MARGIN, 566, RIGHT);

  /* ----------------------------------------------------------------- table */
  const colNo = MARGIN;
  const colName = colNo + 34;
  const colScore = 400;
  const rowH = 22;
  const totalH = 24;
  let top = 542;
  const tableTop = top;

  fill(MARGIN, top - rowH, RIGHT - MARGIN, rowH, 0.94);
  text("S/N", colNo + 10, top - 15, 9, true, 0.25);
  text("Teile", colName + 10, top - 15, 9, true, 0.25);
  text(`Score (${model.scoreMax})`, colScore + 10, top - 15, 9, true, 0.25);
  top -= rowH;
  hLine(MARGIN, RIGHT, top);

  model.rows.forEach((row, index) => {
    if (index % 2 === 1) fill(MARGIN, top - rowH, RIGHT - MARGIN, rowH, 0.975);
    text(`${index + 1}.`, colNo + 10, top - 15, 9.5, false, 0.3);
    text(row.label, colName + 10, top - 15, 10);
    text(scoreText(row.score), colScore + 10, top - 15, 10, true);
    top -= rowH;
    hLine(MARGIN, RIGHT, top);
  });

  fill(MARGIN, top - totalH, RIGHT - MARGIN, totalH, 0.9);
  text("Total Score", colNo + 10, top - 16, 10.5, true);
  textRight(`${scoreText(model.totalScore)} / ${model.maxTotal}`, RIGHT - 10, top - 16, 11, true);
  top -= totalH;
  hLine(MARGIN, RIGHT, top);

  text("Remark", colNo + 10, top - 16, 10.5, true);
  text(model.remark ?? "-", colScore + 10, top - 16, 10, true);
  top -= totalH;

  strokeBox(MARGIN, top, RIGHT - MARGIN, tableTop - top, 0.78, 0.9);
  vLine(colName, tableTop, top);
  vLine(colScore, tableTop, top);

  /* ---------------------------------------------------------------- footer */
  rule(MARGIN, 118, RIGHT);
  textCenter("Phone number: +234 816 545 5895, +234 905 668 4923", PAGE_WIDTH / 2, 100, 9, false, 0.3);
  textCenter("www.alphadeutsch.com · support@alphadeutsch.com", PAGE_WIDTH / 2, 86, 9, false, 0.3);
  textCenter("(c) Alpha Deutsch 2026", PAGE_WIDTH / 2, 70, 9, false, 0.35);

  /* --------------------------------------------------------------- objects */
  const content = latin1(ops.join("\n"));
  const xobjects = images.map((image, index) => `/${image.name} ${8 + index} 0 R`).join(" ");

  const objects: Uint8Array[] = [
    latin1("<< /Type /Catalog /Pages 2 0 R >>"),
    latin1("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    latin1(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        "/Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> " +
        (xobjects ? `/XObject << ${xobjects} >> ` : "") +
        "/ProcSet [/PDF /Text /ImageC] >> " +
        "/Contents 7 0 R >>",
    ),
    latin1("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    latin1("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
    latin1("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"),
    concat([latin1(`<< /Length ${content.length} >>\nstream\n`), content, latin1("\nendstream")]),
  ];

  for (const image of images) {
    objects.push(
      concat([
        latin1(
          `<< /Type /XObject /Subtype /Image /Width ${image.image.width} /Height ${image.image.height} ` +
            "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode " +
            `/Length ${image.image.bytes.length} >>\nstream\n`,
        ),
        image.image.bytes,
        latin1("\nendstream"),
      ]),
    );
  }

  return serialize(objects);
}

/** Safe download name, e.g. `Alpha-Deutsch-Result-2022-AD-25501-1st-Sitting.pdf`. */
export function resultPdfFileName(model: Pick<ResultPdfModel, "regNo" | "sittingLabel">): string {
  const safe = `${model.regNo}-${model.sittingLabel}`
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `Alpha-Deutsch-Result-${safe || "student"}.pdf`;
}
