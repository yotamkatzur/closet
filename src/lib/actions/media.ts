"use server";

import { requireUser } from "@/lib/auth";

// iPhone photos are HEIC/HEIF, which browsers (outside Safari) cannot decode.
// The sell flow tries a normal client-side decode first; if that fails on a
// HEIC file it sends the raw bytes here and we convert to JPEG server-side
// (pure-JS/WASM via heic-convert — no native build needed). The client then
// resizes the returned JPEG with its usual canvas path.
export async function convertHeicToJpeg(
  base64: string,
): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
  try {
    await requireUser();
    const input = Buffer.from(base64, "base64");
    if (input.length === 0) return { ok: false, error: "קובץ ריק" };
    if (input.length > 30_000_000)
      return { ok: false, error: "הקובץ גדול מדי (מקסימום ~30MB)" };

    const convert = (await import("heic-convert")).default;
    const out = await convert({
      buffer: input,
      format: "JPEG",
      quality: 0.92,
    });
    const b64 = Buffer.from(out).toString("base64");
    return { ok: true, dataUrl: `data:image/jpeg;base64,${b64}` };
  } catch {
    return { ok: false, error: "לא הצלחנו להמיר את קובץ ה-HEIC. נסי JPG." };
  }
}
