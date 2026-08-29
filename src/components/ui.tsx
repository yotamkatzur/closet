import Link from "next/link";
import type { ComponentProps } from "react";

export function Header({
  title,
  right,
  back,
}: {
  title: string;
  right?: React.ReactNode;
  back?: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-blush-100 bg-paper/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        {back && (
          <Link href={back} className="text-stone-400" aria-label="חזרה">
            ›
          </Link>
        )}
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-blush-500 text-white hover:bg-blush-600 disabled:opacity-50",
    ghost: "border border-blush-200 text-blush-600 hover:bg-blush-50",
    danger: "border border-red-300 text-red-600 hover:bg-red-50",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${styles} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">
        {label} {hint && <span className="text-stone-400">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-blush-400";

export function Chip({
  active,
  children,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-blush-500 bg-blush-500 text-white"
          : "border-stone-200 bg-white text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-16 text-center text-sm text-stone-400">{children}</div>
  );
}
