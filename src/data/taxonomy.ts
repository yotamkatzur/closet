import type { OccasionTag } from "@/lib/types";

// Occasion taxonomy — the cultural layer (spec section 3). Canonical English
// keys stored; Hebrew labels rendered. Max 3 per item.
export const OCCASIONS: { key: OccasionTag; he: string }[] = [
  { key: "wedding_guest", he: "אורחת בחתונה" },
  { key: "bat_mitzva", he: "בת מצווה" },
  { key: "bar_mitzva", he: "בר מצווה" },
  { key: "henna", he: "חינה" },
  { key: "engagement", he: "אירוסין" },
  { key: "shabbat_dinner", he: "ארוחת שישי / שבת חתן" },
  { key: "gala_formal", he: "אירוע רשמי / גאלה" },
  { key: "cocktail", he: "קוקטייל" },
  { key: "beach_event", he: "אירוע על הים" },
  { key: "new_years", he: "סילבסטר" },
  { key: "graduation", he: "טקס סיום" },
];

export const OCCASION_HE: Record<OccasionTag, string> = Object.fromEntries(
  OCCASIONS.map((o) => [o.key, o.he]),
) as Record<OccasionTag, string>;

export const MAX_OCCASION_TAGS = 3;


export const CITIES = [
  "תל אביב",
  "ירושלים",
  "חיפה",
  "באר שבע",
  "ראשון לציון",
  "פתח תקווה",
  "נתניה",
  "רמת גן",
  "מודיעין",
  "רעננה",
  "הרצליה",
  "כפר סבא",
];
