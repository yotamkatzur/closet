"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BodyCard, FitHistory, PaymentMethod } from "@/lib/types";
import { BODY_SHAPES, FIT_VERDICTS, PAYMENT_METHODS, SIZES } from "@/lib/types";
import {
  saveBodyCard,
  savePaymentMethods,
  updateProfile,
  addFitHistoryEntry,
} from "@/lib/actions/profile";
import { signOut } from "@/lib/actions/auth";
import { PAYMENT_METHOD_HE, SHAPE_HE, VERDICT_HE, he } from "@/data/he";
import { CITIES } from "@/data/taxonomy";
import { Button, Field, inputClass } from "./ui";

export function ProfileForms({
  bodyCard,
  displayName,
  city,
  fitHistory,
  paymentMethods,
  bitPhone,
}: {
  bodyCard: BodyCard | null;
  displayName: string;
  city: string | null;
  fitHistory: FitHistory[];
  paymentMethods: PaymentMethod[];
  bitPhone: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "body" | "profile" | "fit" | "pay">(
    bodyCard ? null : "body",
  );
  const [, start] = useTransition();

  return (
    <div className="space-y-2 border-t border-blush-100 p-4">
      <Row
        label={he.closet.editBodyCard}
        onClick={() => setOpen(open === "body" ? null : "body")}
      />
      {open === "body" && (
        <BodyCardForm card={bodyCard} onDone={() => { setOpen(null); router.refresh(); }} />
      )}

      <Row
        label="פרטי פרופיל"
        onClick={() => setOpen(open === "profile" ? null : "profile")}
      />
      {open === "profile" && (
        <ProfileForm
          name={displayName}
          city={city}
          onDone={() => { setOpen(null); router.refresh(); }}
        />
      )}

      <Row
        label={he.payment.methodsLabel}
        onClick={() => setOpen(open === "pay" ? null : "pay")}
      />
      {open === "pay" && (
        <PaymentForm
          methods={paymentMethods}
          bitPhone={bitPhone}
          onDone={() => { setOpen(null); router.refresh(); }}
        />
      )}

      <Row
        label={`היסטוריית התאמות (${fitHistory.length})`}
        onClick={() => setOpen(open === "fit" ? null : "fit")}
      />
      {open === "fit" && (
        <FitHistoryForm
          history={fitHistory}
          onDone={() => { setOpen(null); router.refresh(); }}
        />
      )}

      <button
        onClick={() => start(async () => { await signOut(); router.push("/"); router.refresh(); })}
        className="mt-2 w-full rounded-xl border border-stone-200 py-2 text-sm text-stone-500"
      >
        {he.auth.signOut}
      </button>
    </div>
  );
}

function PaymentForm({
  methods,
  bitPhone,
  onDone,
}: {
  methods: PaymentMethod[];
  bitPhone: string | null;
  onDone: () => void;
}) {
  const [sel, setSel] = useState<PaymentMethod[]>(methods);
  const [bit, setBit] = useState(bitPhone ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (m: PaymentMethod) =>
    setSel((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  return (
    <div className="space-y-3 rounded-xl border border-blush-100 p-3">
      <p className="text-xs text-stone-400">{he.payment.methodsHint}</p>
      <div className="flex flex-wrap gap-2">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            onClick={() => toggle(m)}
            className={`rounded-full border px-3 py-1 text-sm ${
              sel.includes(m)
                ? "border-blush-500 bg-blush-500 text-white"
                : "border-stone-200"
            }`}
          >
            {PAYMENT_METHOD_HE[m]}
          </button>
        ))}
      </div>
      <Field label={he.payment.bitPhoneLabel} hint={he.common.optional}>
        <input
          className={inputClass}
          dir="ltr"
          value={bit}
          onChange={(e) => setBit(e.target.value)}
          placeholder="05X-XXXXXXX"
        />
      </Field>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await savePaymentMethods({ methods: sel, bitPhone: bit });
            if (r.ok) onDone();
            else setErr(r.error ?? "שגיאה");
          })
        }
      >
        {he.common.save}
      </Button>
    </div>
  );
}

function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm font-medium"
    >
      {label}
      <span className="text-stone-300">›</span>
    </button>
  );
}

function BodyCardForm({
  card,
  onDone,
}: {
  card: BodyCard | null;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    height_cm: card?.height_cm ? String(card.height_cm) : "",
    usual_size: card?.usual_size ?? "",
    bra_size: card?.bra_size ?? "",
    body_shape_tag: card?.body_shape_tag ?? "",
    shoulders_cm: card?.shoulders_cm ? String(card.shoulders_cm) : "",
    waist_cm: card?.waist_cm ? String(card.waist_cm) : "",
    hips_cm: card?.hips_cm ? String(card.hips_cm) : "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 rounded-xl border border-blush-100 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${he.closet.height} (${he.common.cm})`}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={f.height_cm}
            onChange={(e) => setF({ ...f, height_cm: e.target.value })}
          />
        </Field>
        <Field label={he.onboarding.usualSize}>
          <select
            className={inputClass}
            value={f.usual_size}
            onChange={(e) => setF({ ...f, usual_size: e.target.value })}
          >
            <option value="">—</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="מידת חזייה" hint={he.common.optional}>
          <input
            className={inputClass}
            value={f.bra_size}
            onChange={(e) => setF({ ...f, bra_size: e.target.value })}
            placeholder="75C"
          />
        </Field>
        <Field label={he.closet.shape} hint={he.common.optional}>
          <select
            className={inputClass}
            value={f.body_shape_tag}
            onChange={(e) => setF({ ...f, body_shape_tag: e.target.value })}
          >
            <option value="">—</option>
            {BODY_SHAPES.map((s) => (
              <option key={s} value={s}>
                {SHAPE_HE[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["shoulders_cm", "waist_cm", "hips_cm"] as const).map((k) => (
          <Field
            key={k}
            label={
              k === "shoulders_cm"
                ? "כתפיים"
                : k === "waist_cm"
                  ? "מותן"
                  : "ירכיים"
            }
            hint={he.common.optional}
          >
            <input
              className={inputClass}
              inputMode="numeric"
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await saveBodyCard({
              height_cm: f.height_cm,
              usual_size: f.usual_size,
              bra_size: f.bra_size,
              body_shape_tag: f.body_shape_tag,
              shoulders_cm: f.shoulders_cm ? Number(f.shoulders_cm) : undefined,
              waist_cm: f.waist_cm ? Number(f.waist_cm) : undefined,
              hips_cm: f.hips_cm ? Number(f.hips_cm) : undefined,
            });
            if (r.ok) onDone();
            else setErr(r.error ?? "שגיאה");
          })
        }
      >
        {he.common.save}
      </Button>
    </div>
  );
}

function ProfileForm({
  name,
  city,
  onDone,
}: {
  name: string;
  city: string | null;
  onDone: () => void;
}) {
  const [displayName, setName] = useState(name);
  const [c, setCity] = useState(city ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-xl border border-blush-100 p-3">
      <Field label="שם תצוגה">
        <input
          className={inputClass}
          value={displayName}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label={he.closet.city} hint={he.common.optional}>
        <select
          className={inputClass}
          value={c}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">—</option>
          {CITIES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </Field>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await updateProfile({ display_name: displayName, city: c });
            onDone();
          })
        }
      >
        {he.common.save}
      </Button>
    </div>
  );
}

function FitHistoryForm({
  history,
  onDone,
}: {
  history: FitHistory[];
  onDone: () => void;
}) {
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [verdict, setVerdict] = useState<string>("true_to_size");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-xl border border-blush-100 p-3">
      {history.length > 0 && (
        <ul className="space-y-1 text-xs text-stone-500">
          {history.map((h) => (
            <li key={h.id}>
              {h.brand} · {h.size} · {VERDICT_HE[h.verdict]}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input
          className={inputClass}
          placeholder={he.item.brand}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder={he.item.size}
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
        <select
          className={inputClass}
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
        >
          {FIT_VERDICTS.map((v) => (
            <option key={v} value={v}>
              {VERDICT_HE[v]}
            </option>
          ))}
        </select>
      </div>
      <Button
        disabled={pending || !brand || !size}
        onClick={() =>
          start(async () => {
            const r = await addFitHistoryEntry({ brand, size, verdict });
            if (r.ok) {
              setBrand("");
              setSize("");
              onDone();
            }
          })
        }
      >
        {he.common.save}
      </Button>
    </div>
  );
}
