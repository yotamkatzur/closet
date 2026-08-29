import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { buildSearchQuery, runSearch } from "@/lib/search";
import { SearchTracker } from "@/components/SearchTracker";
import { MatchBadge } from "@/components/MatchBadge";
import { Header } from "@/components/ui";
import { OCCASIONS } from "@/data/taxonomy";
import { CONDITION_HE, LENGTH_HE, he, shekels } from "@/data/he";
import { CONDITIONS, LENGTHS, SIZES } from "@/lib/types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const query = buildSearchQuery({
    q: sp.q,
    occasion: sp.occasion,
    size: sp.size,
    length: sp.length,
    color: sp.color,
    min: sp.min,
    max: sp.max,
    condition: sp.condition,
  });
  const hasAny = Object.values(sp).some((v) => v);
  const results = hasAny ? runSearch(query, user?.id ?? null) : [];

  return (
    <div>
      <Header title={he.search.title} back="/" />
      {hasAny && (
        <SearchTracker
          query={sp.q ?? ""}
          filters={Object.fromEntries(
            Object.entries(sp).filter(([k, v]) => k !== "q" && v),
          )}
          resultsCount={results.length}
        />
      )}

      <form method="GET" className="space-y-3 border-b border-blush-100 p-4">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={he.search.queryPlaceholder}
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            name="occasion"
            defaultValue={sp.occasion ?? ""}
            className="rounded-xl border border-stone-200 px-2 py-2 text-sm"
          >
            <option value="">{he.search.occasion}</option>
            {OCCASIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.he}
              </option>
            ))}
          </select>
          <select
            name="size"
            defaultValue={sp.size ?? ""}
            className="rounded-xl border border-stone-200 px-2 py-2 text-sm"
          >
            <option value="">{he.search.size}</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="length"
            defaultValue={sp.length ?? ""}
            className="rounded-xl border border-stone-200 px-2 py-2 text-sm"
          >
            <option value="">{he.search.length}</option>
            {LENGTHS.map((l) => (
              <option key={l} value={l}>
                {LENGTH_HE[l]}
              </option>
            ))}
          </select>
          <select
            name="condition"
            defaultValue={sp.condition ?? ""}
            className="rounded-xl border border-stone-200 px-2 py-2 text-sm"
          >
            <option value="">{he.search.condition}</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_HE[c]}
              </option>
            ))}
          </select>
          <input
            name="color"
            defaultValue={sp.color ?? ""}
            placeholder={he.search.color}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-1">
            <input
              name="min"
              inputMode="numeric"
              defaultValue={sp.min ?? ""}
              placeholder={he.search.minPrice}
              className="w-full rounded-xl border border-stone-200 px-2 py-2 text-sm"
            />
            <input
              name="max"
              inputMode="numeric"
              defaultValue={sp.max ?? ""}
              placeholder={he.search.maxPrice}
              className="w-full rounded-xl border border-stone-200 px-2 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 rounded-full bg-blush-500 py-2 text-sm font-semibold text-white">
            {he.search.apply}
          </button>
          <Link
            href="/search"
            className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-500"
          >
            {he.search.clear}
          </Link>
        </div>
      </form>

      {hasAny && (
        <p className="px-4 py-2 text-xs text-stone-400">
          {he.search.results(results.length)}
        </p>
      )}

      {hasAny && results.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-stone-400">
          {he.search.noResults}
        </p>
      ) : (
        <div className="masonry px-3">
          {results.map((r) => (
            <Link
              key={r.item.id}
              href={`/item/${r.item.id}`}
              className="block overflow-hidden rounded-2xl border border-blush-100 bg-white"
            >
              <div className="aspect-[3/4] bg-blush-50">
                {r.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.cover.url}
                    alt={r.item.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="space-y-1 p-2">
                <p className="font-bold">{shekels(r.item.price_agorot)}</p>
                <p className="truncate text-xs text-stone-500">
                  {r.item.brand ? r.item.brand + " · " : ""}
                  {r.item.title}
                </p>
                <MatchBadge tier={r.tier} label={r.label} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
