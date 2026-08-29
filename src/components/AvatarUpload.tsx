"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fileToResizedDataUrl } from "@/lib/imageResize";
import { removeAvatar, uploadAvatar } from "@/lib/actions/profile";
import { Avatar } from "./Avatar";

export function AvatarUpload({
  name,
  url,
  size = 56,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(url);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      const dataUrl = await fileToResizedDataUrl(f, 512, 0.85);
      setPreview(dataUrl);
      start(async () => {
        const r = await uploadAvatar(dataUrl);
        if (r.ok) router.refresh();
        else {
          setError(r.error ?? "שגיאה");
          setPreview(url);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => fileRef.current?.click()}
        className="relative block"
        aria-label="שינוי תמונת פרופיל"
      >
        <Avatar name={name} url={preview} size={size} />
        <span
          className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blush-500 text-[11px] text-white"
        >
          {pending ? "…" : "✎"}
        </span>
      </button>
      {preview && (
        <button
          onClick={() =>
            start(async () => {
              await removeAvatar();
              setPreview(null);
              router.refresh();
            })
          }
          className="mt-1 block text-[10px] text-stone-400 underline"
        >
          הסרה
        </button>
      )}
      {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
