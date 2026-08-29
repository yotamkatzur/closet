// Israeli mobile number normalisation. Stored canonical form: +9725XXXXXXXX.
export function normalizeIsraeliPhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+972")) d = "0" + d.slice(4);
  else if (d.startsWith("972")) d = "0" + d.slice(3);
  d = d.replace(/\D/g, "");
  // mobile: 05X + 7 digits = 10 digits total
  if (!/^05\d{8}$/.test(d)) return null;
  return "+972" + d.slice(1);
}

export function displayPhone(canonical: string): string {
  // +9725XXXXXXXX -> 05X-XXXXXXX
  const local = "0" + canonical.slice(4);
  return `${local.slice(0, 3)}-${local.slice(3)}`;
}
