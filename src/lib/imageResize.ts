"use client";

import { convertHeicToJpeg } from "@/lib/actions/media";

// Resize client-side before upload: max 1600px long edge, ~85% JPEG quality
// (spec section 2).
//
// HEIC/HEIF (iPhone default) can't be decoded by non-Safari browsers, so when
// the local decode fails on such a file we round-trip the raw bytes through a
// server action that converts to JPEG, then resize that.
export async function fileToResizedDataUrl(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<string> {
  if (file.type && !file.type.startsWith("image/") && !looksHeic(file)) {
    throw new Error("הקובץ אינו תמונה");
  }

  try {
    return await resize(await decodeFile(file), maxEdge, quality);
  } catch (err) {
    if (!looksHeic(file)) throw err;
    // HEIC fallback: convert on the server, then resize the JPEG here.
    const b64 = await fileToBase64(file);
    const res = await convertHeicToJpeg(b64);
    if (!res.ok || !res.dataUrl) {
      throw new Error(res.error ?? "לא הצלחנו לקרוא את התמונה");
    }
    return await resize(await decodeSrc(res.dataUrl), maxEdge, quality);
  }
}

function looksHeic(file: File): boolean {
  return (
    /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
  );
}

async function resize(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
  quality: number,
): Promise<string> {
  const srcW =
    source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source.width;
  const srcH =
    source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source.height;
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH || 1));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas לא נתמך בדפדפן");
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  if ("close" in source) source.close();
  return canvas.toDataURL("image/jpeg", quality);
}

async function decodeFile(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  return decodeSrc(URL.createObjectURL(file), true);
}

function decodeSrc(src: string, revoke = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (revoke) URL.revokeObjectURL(src);
      resolve(img);
    };
    img.onerror = () => {
      if (revoke) URL.revokeObjectURL(src);
      reject(new Error("לא הצלחנו לקרוא את התמונה"));
    };
    img.src = src;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("לא הצלחנו לקרוא את הקובץ"));
    reader.readAsDataURL(file);
  });
}
