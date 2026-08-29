// Email address normalisation. Stored canonical form: trimmed + lower-cased.
export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  if (e.length < 3 || e.length > 254) return null;
  // Deliberately permissive — one @, something either side, a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}
