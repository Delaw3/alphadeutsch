import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { buildResultPdf, resultPdfFileName } = require("../build/result-pdf.js");
const { normalizePhotoPath, photoCandidates } = require("../build/student-photo.js");

const decode = (bytes) => Buffer.from(bytes).toString("latin1");

/** Mirrors the legacy slip from portal.alphadeutsch.com/result. */
function model(overrides = {}) {
  return {
    studentName: "Nwosu Oluchukwu Johnkingsley",
    regNo: "2022/AD/25501",
    email: "gonzidonjk@gmail.com",
    phone: "8149648890",
    dob: "1992-03-20",
    placeOfBirth: "Anambra",
    courseTitle: "A1 Elementary",
    sittingLabel: "1st Sitting",
    rows: [
      { label: "Hören", score: 2, grade: "Teilgenommen" },
      { label: "Lesen", score: 9, grade: "Teilgenommen" },
      { label: "Schreiben", score: 12, grade: "Teilgenommen" },
      { label: "Sprechen", score: 10, grade: "Teilgenommen" },
    ],
    totalScore: 33,
    maxTotal: 100,
    scoreMax: 25,
    remark: "Teilgenommen",
    issuedAt: "25 Nov 2026",
    logo: null,
    photo: null,
    ...overrides,
  };
}

/** 2x2 white JPEG produced by any encoder. */
const TINY_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9,
]);

describe("result PDF", () => {
  it("emits a single-page PDF 1.4 document with a valid xref table", () => {
    const text = decode(buildResultPdf(model()));
    assert.ok(text.startsWith("%PDF-1.4"));
    assert.ok(text.endsWith("%%EOF\n"));
    assert.match(text, /\/Type \/Page\b/);
    assert.match(text, /\/Count 1/);

    const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)?.[1]);
    assert.ok(Number.isInteger(startxref), "startxref offset present");
    assert.equal(text.slice(startxref, startxref + 4), "xref");

    const entries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    assert.equal(entries.length, 7, "catalog, pages, page, three fonts, contents");
    entries.forEach((offset, index) => {
      assert.equal(
        text.slice(offset, offset + `${index + 1} 0 obj`.length),
        `${index + 1} 0 obj`,
        `object ${index + 1} offset must point at its header`,
      );
    });
  });

  it("renders the identity block, the skills table and the totals", () => {
    const text = decode(buildResultPdf(model()));
    assert.match(text, /Nwosu Oluchukwu Johnkingsley/);
    assert.match(text, /2022\/AD\/25501/);
    assert.match(text, /1992-03-20/);
    assert.match(text, /Anambra/);
    assert.match(text, /A1 Elementary/);
    // Parentheses are escaped in the content stream, so the header appears as
    // "Score \(25\)" in the raw bytes.
    assert.ok(text.includes("Score \\(25\\)"), "table header rendered with escaped parentheses");
    assert.match(text, /Total Score/);
    assert.match(text, /33 \/ 100/);
    assert.match(text, /Teilgenommen/);
    // WinAnsi keeps the German umlaut readable in the PDF text stream.
    assert.ok(text.includes("H\u00f6ren"), "Hören must be WinAnsi-encoded");
  });

  it("escapes parentheses so free text cannot break the content stream", () => {
    const text = decode(buildResultPdf(model({ studentName: "Ada (Ann) Obi" })));
    assert.ok(text.includes("Ada \\(Ann\\) Obi"));
  });

  it("embeds JPEG images with /DCTDecode and nothing else", () => {
    const withPhoto = decode(
      buildResultPdf(
        model({
          photo: { bytes: TINY_JPEG, width: 2, height: 2 },
          logo: { bytes: TINY_JPEG, width: 2, height: 2 },
        }),
      ),
    );
    assert.match(withPhoto, /\/Subtype \/Image/);
    assert.match(withPhoto, /\/Filter \/DCTDecode/);
    assert.match(withPhoto, /\/XObject << \/Im1 8 0 R \/Im2 9 0 R >>/);
    assert.equal(withPhoto.match(/\/Subtype \/Image/g)?.length, 2);

    const withoutPhoto = decode(buildResultPdf(model()));
    assert.doesNotMatch(withoutPhoto, /\/DCTDecode/);
    assert.doesNotMatch(withoutPhoto, /\/XObject/);
  });

  it("does not print the sitting number", () => {
    const text = decode(buildResultPdf(model({ sittingLabel: "3rd Sitting" })));
    assert.ok(!text.includes("3rd Sitting"), "sitting label must not appear in the document");
    assert.ok(!/Sitting/.test(text), "no sitting wording at all");
  });

  it("fits the passport photo inside the frame without stretching it", () => {
    const text = decode(
      buildResultPdf(model({ photo: { bytes: TINY_JPEG, width: 400, height: 300 } })),
    );
    const match = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im1 Do Q/.exec(text);
    assert.ok(match, "image draw operator present");

    const width = Number(match[1]);
    const height = Number(match[2]);
    const x = Number(match[3]);
    const y = Number(match[4]);

    // Original 4:3 aspect ratio must survive (92x69 for the 92x115 frame).
    assert.ok(Math.abs(width / height - 400 / 300) < 0.01, "aspect ratio preserved");
    assert.ok(width <= 92.001 && height <= 115.001, "image fits inside the frame");
    // ...and stays centred inside the frame at x=40, y=590.
    assert.ok(Math.abs(x - (40 + (92 - width) / 2)) < 0.01, "centred horizontally");
    assert.ok(Math.abs(y - (590 + (115 - height) / 2)) < 0.01, "centred vertically");
  });

  it("builds a safe download file name", () => {
    assert.equal(
      resultPdfFileName({ regNo: "2022/AD/25501", sittingLabel: "1st Sitting" }),
      "Alpha-Deutsch-Result-2022-AD-25501-1st-Sitting.pdf",
    );
  });
});

describe("student photo paths", () => {
  it("accepts only safe relative paths", () => {
    assert.equal(normalizePhotoPath(" 8461321659723948627.jpg "), "8461321659723948627.jpg");
    assert.equal(normalizePhotoPath("uploads/1742213889_67d8130141a0b.png"), "uploads/1742213889_67d8130141a0b.png");
    assert.equal(normalizePhotoPath(""), null);
    assert.equal(normalizePhotoPath(null), null);
    assert.equal(normalizePhotoPath("../secrets.jpg"), null);
    assert.equal(normalizePhotoPath("/etc/passwd"), null);
    assert.equal(normalizePhotoPath("https://evil.example/x.jpg"), null);
    assert.equal(normalizePhotoPath("a b.jpg"), null);
  });

  it("tries PROFILE_IMAGE first, then the legacy Upload folder", () => {
    assert.deepEqual(photoCandidates("8461321659723948627.jpg", {}), [
      "https://portal.alphadeutsch.com/PROFILE_IMAGE/8461321659723948627.jpg",
      "https://portal.alphadeutsch.com/Upload/8461321659723948627.jpg",
      "https://portal.alphadeutsch.com/8461321659723948627.jpg",
    ]);
  });

  it("honours STUDENT_PHOTO_BASE_URL and relative course_reg paths", () => {
    const urls = photoCandidates("uploads/1742213889_67d8130141a0b.png", {
      STUDENT_PHOTO_BASE_URL: "https://cdn.example/photos/",
    });
    assert.equal(urls[0], "https://cdn.example/photos/uploads/1742213889_67d8130141a0b.png");
    assert.ok(urls.includes("https://portal.alphadeutsch.com/uploads/1742213889_67d8130141a0b.png"));
  });

  it("returns no candidates for an empty or unsafe value", () => {
    assert.deepEqual(photoCandidates("", {}), []);
    assert.deepEqual(photoCandidates("http://evil.example/x.jpg", {}), []);
  });
});
