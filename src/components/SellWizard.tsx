"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fileToResizedDataUrl } from "@/lib/imageResize";
import {
  autofillFromPhoto,
  createListing,
  updateListing,
} from "@/lib/actions/items";
import type { AutoFill } from "@/lib/providers/ai";
import type { Item, ItemPhoto } from "@/lib/types";
import {
  BACK_STYLES,
  CONDITIONS,
  FABRICS,
  FIT_VERDICTS,
  LENGTHS,
  NECKLINES,
  SIZES,
  SLEEVES,
  type OccasionTag,
} from "@/lib/types";
import { OCCASIONS, MAX_OCCASION_TAGS } from "@/data/taxonomy";
import {
  BACK_HE,
  CONDITION_HE,
  FABRIC_HE,
  LENGTH_HE,
  NECKLINE_HE,
  SLEEVE_HE,
  VERDICT_HE,
  he,
  shekels,
} from "@/data/he";
import { Button, Field, inputClass } from "./ui";

interface Photo {
  key: string;
  on_body: boolean;
  src: string; // url (existing) or dataUrl (new) — for <img>
  existingId?: string; // set for photos already saved
  dataUrl?: string; // set for newly added photos (to upload)
}

const empty = {
  title: "",
  brand: "",
  label_size: "",
  owner_verdict: "" as "" | (typeof FIT_VERDICTS)[number],
  color: "",
  length: "" as "" | (typeof LENGTHS)[number],
  neckline: "" as "" | (typeof NECKLINES)[number],
  sleeve: "" as "" | (typeof SLEEVES)[number],
  back: "" as "" | (typeof BACK_STYLES)[number],
  fabric: "" as "" | (typeof FABRICS)[number],
  condition: "like_new" as (typeof CONDITIONS)[number],
  price: "",
  original_price: "",
  description: "",
};

type FormState = typeof empty;

export interface EditContext {
  itemId: string;
  item: Item;
  photos: ItemPhoto[];
}

function formFromItem(item: Item): FormState {
  return {
    title: item.title,
    brand: item.brand ?? "",
    label_size: item.label_size,
    owner_verdict: item.owner_verdict ?? "",
    color: item.color,
    length: item.length,
    neckline: item.neckline,
    sleeve: item.sleeve,
    back: item.back ?? "",
    fabric: item.fabric ?? "",
    condition: item.condition,
    price: String(Math.round(item.price_agorot / 100)),
    original_price: item.original_price_agorot
      ? String(Math.round(item.original_price_agorot / 100))
      : "",
    description: item.description,
  };
}

let keyCounter = 0;
const nextKey = () => `p${keyCounter++}`;

export function SellWizard({
  comparablePrices,
  edit,
}: {
  comparablePrices: number[];
  edit?: EditContext;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  const [photos, setPhotos] = useState<Photo[]>(
    edit
      ? edit.photos.map((p) => ({
          key: nextKey(),
          on_body: p.on_body,
          src: p.url,
          existingId: p.id,
        }))
      : [],
  );
  const [form, setForm] = useState<FormState>(
    edit ? formFromItem(edit.item) : { ...empty },
  );
  const [tags, setTags] = useState<OccasionTag[]>(
    edit ? [...edit.item.occasion_tags] : [],
  );
  const [aiState, setAiState] = useState<"idle" | "running" | "done" | "failed">(
    edit ? "done" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [pending, start] = useTransition();

  const isEdit = !!edit;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setLoadingPhotos(true);
    try {
      await ingest(files);
    } finally {
      setLoadingPhotos(false);
    }
  }

  async function ingest(files: FileList) {
    const added: Photo[] = [];
    let lastErr: string | null = null;
    for (const f of Array.from(files).slice(0, 6)) {
      try {
        const dataUrl = await fileToResizedDataUrl(f);
        added.push({
          key: nextKey(),
          dataUrl,
          src: dataUrl,
          on_body: photos.length + added.length === 0,
        });
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "לא הצלחנו לטעון את התמונה";
      }
    }
    if (added.length === 0) {
      setError(lastErr ?? "לא הצלחנו לטעון את התמונה");
      return;
    }
    if (lastErr) setError(lastErr);
    const next = [...photos, ...added].slice(0, 6);
    setPhotos(next);

    // AI auto-fill from the first photo only, once — new listings only.
    if (!isEdit && aiState === "idle" && added[0]?.dataUrl) {
      setAiState("running");
      const result = await autofillFromPhoto(added[0].dataUrl);
      applyAutofill(result);
      setAiState(
        result.color || result.length || result.title ? "done" : "failed",
      );
    }
  }

  function applyAutofill(a: AutoFill) {
    setForm((f) => ({
      ...f,
      title: f.title || a.title || "",
      brand: f.brand || a.brand || "",
      color: f.color || a.color || "",
      length: f.length || a.length || "",
      neckline: f.neckline || a.neckline || "",
      sleeve: f.sleeve || a.sleeve || "",
      back: f.back || a.back || "",
      fabric: f.fabric || a.fabric || "",
    }));
    if (a.occasion_tags.length && tags.length === 0)
      setTags(a.occasion_tags.slice(0, MAX_OCCASION_TAGS));
  }

  function toggleTag(t: OccasionTag) {
    setTags((cur) =>
      cur.includes(t)
        ? cur.filter((x) => x !== t)
        : cur.length < MAX_OCCASION_TAGS
          ? [...cur, t]
          : cur,
    );
  }

  const baseValid =
    photos.some((p) => p.on_body) &&
    form.title.trim().length >= 2 &&
    form.color.trim() &&
    form.label_size.trim() &&
    form.length &&
    form.neckline &&
    form.sleeve &&
    Number(form.price) >= 10;

  function fields() {
    return {
      title: form.title,
      brand: form.brand,
      label_size: form.label_size,
      owner_verdict: form.owner_verdict,
      color: form.color,
      length: form.length,
      neckline: form.neckline,
      sleeve: form.sleeve,
      back: form.back,
      fabric: form.fabric,
      occasion_tags: tags,
      condition: form.condition,
      price_agorot: Math.round(Number(form.price) * 100),
      original_price_agorot: form.original_price
        ? Math.round(Number(form.original_price) * 100)
        : undefined,
      description: form.description,
    };
  }

  function submitNew(publish: boolean) {
    setError(null);
    start(async () => {
      const res = await createListing(
        fields(),
        photos.map((p) => ({ dataUrl: p.dataUrl!, on_body: p.on_body })),
        publish,
      );
      if (res.ok && res.itemId) {
        router.push(publish ? `/item/${res.itemId}` : "/deals");
        router.refresh();
      } else setError(res.error ?? "שגיאה");
    });
  }

  function submitEdit() {
    if (!edit) return;
    setError(null);
    start(async () => {
      const res = await updateListing(edit.itemId, fields(), {
        keep: photos
          .filter((p) => p.existingId)
          .map((p) => ({ id: p.existingId!, on_body: p.on_body })),
        add: photos
          .filter((p) => p.dataUrl)
          .map((p) => ({ dataUrl: p.dataUrl!, on_body: p.on_body })),
      });
      if (res.ok) {
        router.push(`/item/${edit.itemId}`);
        router.refresh();
      } else setError(res.error ?? "שגיאה");
    });
  }

  return (
    <div className="space-y-6 p-4">
      {/* Photos */}
      <section>
        <p className="mb-2 text-sm text-stone-500">{he.sell.onBodyPrompt}</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt=""
                className="h-24 w-24 rounded-xl object-cover"
              />
              <label className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px]">
                <input
                  type="checkbox"
                  checked={p.on_body}
                  onChange={(e) =>
                    setPhotos((cur) =>
                      cur.map((x) =>
                        x.key === p.key
                          ? { ...x, on_body: e.target.checked }
                          : x,
                      ),
                    )
                  }
                />
                {he.sell.onBodyToggle}
              </label>
              <button
                onClick={() =>
                  setPhotos((cur) => cur.filter((x) => x.key !== p.key))
                }
                className="absolute -left-1 -top-1 h-5 w-5 rounded-full bg-stone-800 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="h-24 w-24 rounded-xl border-2 border-dashed border-blush-200 text-2xl text-blush-300"
          >
            ＋
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif,image/heic,image/heif"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        {loadingPhotos && (
          <p className="mt-2 text-xs text-blush-500">מעבד את התמונות…</p>
        )}
        {!isEdit && aiState === "running" && (
          <p className="mt-2 text-xs text-blush-500">{he.sell.aiFilling}</p>
        )}
        {!isEdit && aiState === "done" && (
          <p className="mt-2 text-xs text-stone-400">{he.sell.aiHint}</p>
        )}
        {!isEdit && aiState === "failed" && (
          <p className="mt-2 text-xs text-stone-400">{he.sell.aiFailed}</p>
        )}
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </section>

      {/* Details */}
      <section className="space-y-3">
        <Field label={he.sell.titleField}>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={he.item.brand} hint={he.common.optional}>
            <input
              className={inputClass}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
            />
          </Field>
          <Field label={he.item.color}>
            <input
              className={inputClass}
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SelectField
            label={he.item.length}
            value={form.length}
            onChange={(v) => set("length", v as FormState["length"])}
            options={LENGTHS.map((l) => [l, LENGTH_HE[l]])}
          />
          <SelectField
            label={he.item.neckline}
            value={form.neckline}
            onChange={(v) => set("neckline", v as FormState["neckline"])}
            options={NECKLINES.map((n) => [n, NECKLINE_HE[n]])}
          />
          <SelectField
            label={he.item.sleeve}
            value={form.sleeve}
            onChange={(v) => set("sleeve", v as FormState["sleeve"])}
            options={SLEEVES.map((s) => [s, SLEEVE_HE[s]])}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SelectField
            label={he.item.back}
            value={form.back}
            onChange={(v) => set("back", v as FormState["back"])}
            options={BACK_STYLES.map((b) => [b, BACK_HE[b]])}
          />
          <SelectField
            label={he.item.fabric}
            value={form.fabric}
            onChange={(v) => set("fabric", v as FormState["fabric"])}
            options={FABRICS.map((x) => [x, FABRIC_HE[x]])}
          />
          <SelectField
            label={he.item.condition}
            value={form.condition}
            onChange={(v) => set("condition", v as FormState["condition"])}
            options={CONDITIONS.map((c) => [c, CONDITION_HE[c]])}
          />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">
            {he.item.occasions} · {he.common.optional} (עד {MAX_OCCASION_TAGS})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {OCCASIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => toggleTag(o.key)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  tags.includes(o.key)
                    ? "border-blush-500 bg-blush-500 text-white"
                    : "border-stone-200"
                }`}
              >
                {o.he}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Size + verdict */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={he.item.labelSize}>
            <input
              className={inputClass}
              value={form.label_size}
              onChange={(e) => set("label_size", e.target.value)}
              placeholder="M / 38 / 8"
              list={`${fieldId}-sizes`}
            />
            <datalist id={`${fieldId}-sizes`}>
              {SIZES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <SelectField
            label={he.sell.ownerVerdictQ}
            value={form.owner_verdict}
            onChange={(v) =>
              set("owner_verdict", v as FormState["owner_verdict"])
            }
            options={FIT_VERDICTS.map((v) => [v, VERDICT_HE[v]])}
          />
        </div>
      </section>

      {/* Price */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={he.item.price + " (₪)"}>
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </Field>
          <Field
            label={he.item.originalPrice + " (₪)"}
            hint={he.common.optional}
          >
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.original_price}
              onChange={(e) => set("original_price", e.target.value)}
            />
          </Field>
        </div>
        <p className="text-xs text-stone-400">
          {comparablePrices.length
            ? `${he.sell.comparablePrices(comparablePrices.length)}: ` +
              comparablePrices
                .slice(0, 3)
                .map((a) => shekels(a))
                .join(" · ")
            : he.sell.noComparables}
        </p>
        <Field label={he.item.description} hint={he.common.optional}>
          <textarea
            className={inputClass + " h-24"}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!photos.some((p) => p.on_body) && photos.length > 0 && (
        <p className="text-xs text-blush-600">{he.sell.needOnBody}</p>
      )}

      {isEdit ? (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={!baseValid || pending}
            onClick={submitEdit}
          >
            {he.sell.saveChanges}
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => router.push(`/item/${edit!.itemId}`)}
          >
            {he.common.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={!baseValid || pending}
            onClick={() => submitNew(true)}
          >
            {he.sell.publish}
          </Button>
          <Button
            variant="ghost"
            disabled={photos.length === 0 || pending}
            onClick={() => submitNew(false)}
          >
            {he.sell.saveDraft}
          </Button>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Field label={label}>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}
