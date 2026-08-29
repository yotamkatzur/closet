import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-4xl">◇</p>
      <p className="text-sm text-stone-500">הדף לא נמצא</p>
      <Link
        href="/"
        className="rounded-full bg-blush-500 px-4 py-2 text-sm font-semibold text-white"
      >
        חזרה לפיד
      </Link>
    </div>
  );
}
