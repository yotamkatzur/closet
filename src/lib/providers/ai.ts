// The only AI in v1: listing intake auto-fill from a photo (spec section 5.6).
// Single vision call, structured JSON. 3s timeout. On any failure fall through
// to an empty manual form — NEVER block publishing on the AI.

import { config } from "@/lib/config";
import type {
  BackStyle,
  Fabric,
  Length,
  Neckline,
  OccasionTag,
  Sleeve,
} from "@/lib/types";

export interface AutoFill {
  title: string | null;
  brand: string | null;
  color: string | null;
  length: Length | null;
  neckline: Neckline | null;
  sleeve: Sleeve | null;
  back: BackStyle | null;
  fabric: Fabric | null;
  occasion_tags: OccasionTag[];
}

export const EMPTY_AUTOFILL: AutoFill = {
  title: null,
  brand: null,
  color: null,
  length: null,
  neckline: null,
  sleeve: null,
  back: null,
  fabric: null,
  occasion_tags: [],
};

export interface AIProvider {
  autofillFromPhoto(imageDataUrl: string): Promise<AutoFill>;
}

const TIMEOUT_MS = 3000;

/** Deterministic fake — no API key needed. Varies output by image hash so the
 * founder can demo "the AI guessed X" without a real model. */
export class StubAIProvider implements AIProvider {
  async autofillFromPhoto(imageDataUrl: string): Promise<AutoFill> {
    let h = 0;
    for (let i = 0; i < imageDataUrl.length; i += 977) {
      h = (h * 31 + imageDataUrl.charCodeAt(i)) >>> 0;
    }
    const colors = ["שחור", "אדום", "כחול נייבי", "אמרלד", "שמפניה", "ורוד עתיק"];
    const lengths: Length[] = ["midi", "maxi", "mini"];
    const necklines: Neckline[] = ["v_neck", "strapless", "one_shoulder", "square"];
    const sleeves: Sleeve[] = ["sleeveless", "long", "short"];
    const backs: BackStyle[] = ["open", "closed"];
    const fabrics: Fabric[] = ["satin", "chiffon", "lace", "velvet", "sequin"];
    const occ: OccasionTag[][] = [
      ["wedding_guest", "gala_formal"],
      ["cocktail", "engagement"],
      ["bat_mitzva", "shabbat_dinner"],
      ["new_years", "cocktail"],
    ];
    const color = colors[h % colors.length];
    const length = lengths[h % lengths.length];
    return {
      title: `שמלת ערב ${color}`,
      brand: null,
      color,
      length,
      neckline: necklines[h % necklines.length],
      sleeve: sleeves[h % sleeves.length],
      back: backs[h % backs.length],
      fabric: fabrics[h % fabrics.length],
      occasion_tags: occ[h % occ.length],
    };
  }
}

/** Real vision call via the Anthropic Messages API. */
export class ClaudeAIProvider implements AIProvider {
  async autofillFromPhoto(imageDataUrl: string): Promise<AutoFill> {
    const m = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/s);
    if (!m) return EMPTY_AUTOFILL;
    const [, mediaType, b64] = m;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": config.anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 400,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: b64 },
                },
                {
                  type: "text",
                  text: PROMPT,
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) return EMPTY_AUTOFILL;
      const json = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = json.content?.find((c) => c.type === "text")?.text ?? "";
      const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
      return coerce(parsed);
    } catch {
      return EMPTY_AUTOFILL;
    } finally {
      clearTimeout(timer);
    }
  }
}

const PROMPT = `You are tagging a second-hand evening dress for an Israeli resale app.
Return ONLY minified JSON matching:
{"title":string|null,"brand":string|null,"color":string(Hebrew)|null,
"length":"mini"|"midi"|"maxi"|null,
"neckline":"strapless"|"v_neck"|"square"|"halter"|"one_shoulder"|"high_neck"|"collar"|"other"|null,
"sleeve":"sleeveless"|"short"|"three_quarter"|"long"|null,
"back":"open"|"closed"|null,
"fabric":"satin"|"chiffon"|"lace"|"velvet"|"tulle"|"silk"|"crepe"|"jersey"|"organza"|"sequin"|"knit"|"other"|null,
"occasion_tags":array of up to 3 of
["wedding_guest","bat_mitzva","bar_mitzva","henna","engagement","shabbat_dinner","gala_formal","cocktail","beach_event","new_years","graduation"]}
title and color in Hebrew. Use null when unsure. No prose.`;

function coerce(x: unknown): AutoFill {
  const o = (x ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
    typeof v === "string" && (allowed as readonly string[]).includes(v)
      ? (v as T)
      : null;
  const OCC = [
    "wedding_guest",
    "bat_mitzva",
    "bar_mitzva",
    "henna",
    "engagement",
    "shabbat_dinner",
    "gala_formal",
    "cocktail",
    "beach_event",
    "new_years",
    "graduation",
  ] as const;
  return {
    title: str(o.title),
    brand: str(o.brand),
    color: str(o.color),
    length: oneOf(o.length, ["mini", "midi", "maxi"] as const),
    neckline: oneOf(o.neckline, [
      "strapless",
      "v_neck",
      "square",
      "halter",
      "one_shoulder",
      "high_neck",
      "collar",
      "other",
    ] as const),
    sleeve: oneOf(o.sleeve, [
      "sleeveless",
      "short",
      "three_quarter",
      "long",
    ] as const),
    back: oneOf(o.back, ["open", "closed"] as const),
    fabric: oneOf(o.fabric, [
      "satin",
      "chiffon",
      "lace",
      "velvet",
      "tulle",
      "silk",
      "crepe",
      "jersey",
      "organza",
      "sequin",
      "knit",
      "other",
    ] as const),
    occasion_tags: Array.isArray(o.occasion_tags)
      ? (o.occasion_tags
          .map((t) => oneOf(t, OCC))
          .filter(Boolean)
          .slice(0, 3) as OccasionTag[])
      : [],
  };
}

let _ai: AIProvider | null = null;
export function aiProvider(): AIProvider {
  if (_ai) return _ai;
  _ai =
    config.aiDriver === "claude" && config.anthropicApiKey
      ? new ClaudeAIProvider()
      : new StubAIProvider();
  return _ai;
}
