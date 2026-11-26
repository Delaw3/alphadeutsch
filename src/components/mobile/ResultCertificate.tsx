"use client";

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";

import { MiniSpinner } from "./MobileLoaders";
import { buildResultPdf, resultPdfFileName, type ResultPdfModel } from "@/lib/result-pdf";
import {
  downloadPdf,
  fetchPhotoBlob,
  loadAppLogo,
  sharePdf,
  toPdfJpeg,
} from "@/lib/result-pdf-client";

export type CertificateStudent = {
  reg_no: string;
  fullname: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  place_of_birth: string | null;
  has_photo: boolean;
};

export type CertificateResult = {
  course_title: string;
  sitting: number;
  horen_score: number | null;
  horen_grade: string | null;
  lesen_score: number | null;
  lesen_grade: string | null;
  schreiben_score: number | null;
  schreiben_grade: string | null;
  sprechen_score: number | null;
  sprechen_grade: string | null;
  total_score: number | null;
  overall_grade: string | null;
  student?: CertificateStudent | null;
};

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "AD"
  );
}

/**
 * Printable result slip.
 *
 * Mirrors the legacy portal layout (reg no, DOB, place of birth, passport
 * photo, course, four skills out of 25, total /100, remark, contacts) in the
 * app's own design language, plus "Download PDF" / "Share PDF" actions that
 * build the document locally — no server round-trip, no PDF dependency.
 */
export function ResultCertificate({
  result,
  sittingLabel,
}: {
  result: CertificateResult;
  sittingLabel: string;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const [status, setStatus] = useState("");

  const student = result.student ?? null;
  const name = student?.fullname?.trim() || "Student";
  const rows = [
    { label: "Hören", score: result.horen_score, grade: result.horen_grade },
    { label: "Lesen", score: result.lesen_score, grade: result.lesen_grade },
    { label: "Schreiben", score: result.schreiben_score, grade: result.schreiben_grade },
    { label: "Sprechen", score: result.sprechen_score, grade: result.sprechen_grade },
  ];
  const scoreMax = Math.max(0, ...rows.map((row) => row.score ?? 0)) > 25 ? 100 : 25;
  const maxTotal = scoreMax === 25 ? 100 : 400;
  const remark = result.overall_grade ?? rows.find((row) => row.grade)?.grade ?? null;

  // Passport photo from the authenticated proxy; the object URL is revoked on unmount.
  useEffect(() => {
    if (!student?.has_photo) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void fetchPhotoBlob().then((blob) => {
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setPhotoUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [student?.has_photo, student?.reg_no]);

  async function buildModel(): Promise<ResultPdfModel> {
    const [photo, logo] = await Promise.all([toPdfJpeg(await fetchPhotoBlob(), 640), loadAppLogo()]);
    return {
      studentName: name,
      regNo: student?.reg_no ?? "-",
      email: student?.email ?? null,
      phone: student?.phone ?? null,
      dob: student?.dob ?? null,
      placeOfBirth: student?.place_of_birth ?? null,
      courseTitle: result.course_title,
      sittingLabel,
      rows,
      totalScore: result.total_score,
      maxTotal,
      scoreMax,
      remark,
      issuedAt: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      logo,
      photo,
    };
  }

  async function handleDownload() {
    if (busy) return;
    setBusy("pdf");
    setStatus("");
    try {
      const model = await buildModel();
      downloadPdf(buildResultPdf(model), resultPdfFileName(model));
      setStatus("PDF downloaded.");
    } catch {
      setStatus("Could not create the PDF. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    if (busy) return;
    setBusy("share");
    setStatus("");
    try {
      const model = await buildModel();
      const bytes = buildResultPdf(model);
      const outcome = await sharePdf(
        bytes,
        resultPdfFileName(model),
        `Alpha Deutsch result · ${model.regNo}`,
      );
      setStatus(
        outcome === "shared"
          ? "PDF shared."
          : outcome === "downloaded"
            ? "Sharing is not available here, so the PDF was downloaded."
            : "",
      );
    } catch {
      setStatus("Could not share the PDF. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="certificate overflow-hidden rounded-3xl border border-app-border bg-app-surface shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <header className="flex items-center justify-between gap-3 border-b border-app-border bg-app-surface-2/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <img src="/brand/logo-256.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
          <div>
            <p className="text-[13px] font-black leading-tight text-app-text">Alpha Deutsch</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-app-muted">Result slip</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-app-accent/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-app-text">
          {sittingLabel}
        </span>
      </header>

      <div className="px-5 py-5">
        <div className="flex items-start gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${name} passport photo`}
              className="h-[104px] w-[84px] shrink-0 rounded-xl border border-app-border bg-app-surface-2 object-contain"
            />
          ) : (
            <div className="grid h-[104px] w-[84px] shrink-0 place-items-center rounded-xl border border-app-border bg-app-surface-2 text-lg font-black text-app-muted">
              {initialsOf(name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-black leading-tight text-app-text">{name}</h3>
            <dl className="mt-1 grid gap-0.5 text-[11px] leading-5 text-app-muted">
              <div className="flex gap-1">
                <dt className="shrink-0 font-black">Reg.</dt>
                <dd className="truncate">{student?.reg_no ?? "—"}</dd>
              </div>
              {student?.email ? (
                <div className="flex gap-1">
                  <dt className="shrink-0 font-black">Email</dt>
                  <dd className="truncate">{student.email}</dd>
                </div>
              ) : null}
              {student?.phone ? (
                <div className="flex gap-1">
                  <dt className="shrink-0 font-black">Tel.</dt>
                  <dd className="truncate">{student.phone}</dd>
                </div>
              ) : null}
              <div className="flex gap-1">
                <dt className="shrink-0 font-black">DOB</dt>
                <dd className="truncate">{student?.dob ?? "—"}</dd>
              </div>
              <div className="flex gap-1">
                <dt className="shrink-0 font-black">Born in</dt>
                <dd className="truncate">{student?.place_of_birth ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-app-surface-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-app-muted">Course</p>
            <p className="truncate text-sm font-black text-app-text">{result.course_title}</p>
          </div>
          <span className="shrink-0 text-[11px] font-black text-app-muted">{sittingLabel}</span>
        </div>

        <table className="mt-4 w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-app-surface-2 text-left text-[10px] uppercase tracking-[0.1em] text-app-muted">
              <th className="w-8 rounded-l-lg py-2 pl-3 font-black">#</th>
              <th className="py-2 font-black">Teile</th>
              <th className="w-16 py-2 text-right font-black">Score ({scoreMax})</th>
              <th className="w-24 rounded-r-lg py-2 pr-3 text-right font-black">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="border-b border-app-border/60 last:border-0">
                <td className="py-2.5 pl-3 tabular-nums text-app-muted">{index + 1}.</td>
                <td className="py-2.5 font-bold text-app-text">{row.label}</td>
                <td className="py-2.5 text-right font-black tabular-nums text-app-text">
                  {row.score ?? "—"}
                </td>
                <td className="py-2.5 pr-3 text-right text-[11px] font-bold text-app-muted">
                  {row.grade ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-app-border bg-app-surface-2">
              <td colSpan={2} className="py-3 pl-3 text-[12px] font-black text-app-text">
                Total score
              </td>
              <td className="py-3 text-right text-[13px] font-black tabular-nums text-app-text">
                {result.total_score ?? "—"}
                <span className="text-[10px] font-bold text-app-muted"> / {maxTotal}</span>
              </td>
              <td className="py-3 pr-3 text-right text-[11px] font-black text-app-text">
                {remark ?? "—"}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="no-print mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy !== null}
            aria-busy={busy === "pdf"}
            className="focus-ring inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-app-accent text-[13px] font-black text-app-on-accent transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy === "pdf" ? <MiniSpinner /> : <Download size={16} strokeWidth={2.5} />}
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={busy !== null}
            aria-busy={busy === "share"}
            className="focus-ring inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-app-border bg-app-surface-2 text-[13px] font-black text-app-text transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy === "share" ? <MiniSpinner /> : <Share2 size={16} strokeWidth={2.5} />}
            Share PDF
          </button>
        </div>
        {status ? (
          <p role="status" aria-live="polite" className="mt-2 text-center text-[11px] text-app-muted">
            {status}
          </p>
        ) : null}
      </div>

      <footer className="border-t border-app-border px-5 py-4 text-center text-[10px] leading-5 text-app-muted">
        <p>+234 816 545 5895 · +234 905 668 4923</p>
        <p>www.alphadeutsch.com · support@alphadeutsch.com</p>
        <p className="mt-1 font-black">(c) Alpha Deutsch 2026</p>
      </footer>
    </section>
  );
}
