"use client";

/**
 * Client-side helpers for the PDF result slip.
 *
 * `apiFetch` only speaks JSON, so the photo is fetched here with the platform
 * token store, converted to JPEG through a canvas (same-origin blob => the
 * canvas is never tainted) and handed to the dependency-free PDF writer.
 */

import { getToken } from "@/lib/token-store";
import type { ResultPdfImage } from "@/lib/result-pdf";

function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}${path}`;
}

/** Authenticated binary GET for `/api/me/photo` (Bearer or cookie). */
export async function fetchPhotoBlob(): Promise<Blob | null> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    const response = await fetch(apiUrl("/api/me/photo"), { headers, cache: "no-store" });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").startsWith("image/")) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

function loadImage(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/** Re-encodes an image as JPEG so the PDF can embed it with `/DCTDecode`. */
export async function toPdfJpeg(blob: Blob | null, maxSize = 640): Promise<ResultPdfImage | null> {
  if (!blob) return null;
  const image = await loadImage(blob);
  if (!image || !image.naturalWidth || !image.naturalHeight) return null;

  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null; // tainted canvas: skip the image rather than fail the PDF
  }

  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { bytes, width, height };
}

/** The app logo used in the certificate header (same-origin, canvas-safe). */
export async function loadAppLogo(): Promise<ResultPdfImage | null> {
  try {
    const response = await fetch("/brand/logo-256.png", { cache: "force-cache" });
    if (!response.ok) return null;
    return await toPdfJpeg(await response.blob(), 256);
  } catch {
    return null;
  }
}

function pdfBlob(bytes: Uint8Array): Blob {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}

export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(pdfBlob(bytes));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/** Shares the PDF file when the platform supports it, else downloads it. */
export async function sharePdf(
  bytes: Uint8Array,
  fileName: string,
  title: string,
): Promise<ShareOutcome> {
  const file = new File([pdfBlob(bytes)], fileName, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
    }
  }

  downloadPdf(bytes, fileName);
  return "downloaded";
}
