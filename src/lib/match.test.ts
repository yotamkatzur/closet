import { describe, expect, it } from "vitest";
import {
  diffSentence,
  fitOverlap,
  heightProximity,
  matchScore,
  sizeOrdinal,
  sizeProximity,
  tierFor,
} from "./match";
import type { BodyCard, FitHistory } from "./types";

const card = (over: Partial<BodyCard>): BodyCard => ({
  user_id: "u",
  height_cm: 168,
  usual_size: "M",
  bra_size: null,
  body_shape_tag: null,
  shoulders_cm: null,
  waist_cm: null,
  hips_cm: null,
  updated_at: "",
  ...over,
});

describe("sizeOrdinal", () => {
  it("maps XS..XXL to 0..5", () => {
    expect(sizeOrdinal("XS")).toBe(0);
    expect(sizeOrdinal("S")).toBe(1);
    expect(sizeOrdinal("M")).toBe(2);
    expect(sizeOrdinal("L")).toBe(3);
    expect(sizeOrdinal("XL")).toBe(4);
    expect(sizeOrdinal("XXL")).toBe(5);
  });
  it("puts between-sizes on half-steps", () => {
    expect(sizeOrdinal("S-M")).toBe(1.5);
    expect(sizeOrdinal("M-L")).toBe(2.5);
  });
});

describe("sizeProximity with between-sizes", () => {
  it("S-M is closer to M than S is to M", () => {
    expect(sizeProximity("S-M", "M")).toBe(0.75);
    expect(sizeProximity("S", "M")).toBe(0.5);
  });
  it("S-M sits exactly between its neighbours", () => {
    expect(sizeProximity("S-M", "S")).toBe(0.75);
    expect(sizeProximity("S-M", "L")).toBe(0.25);
  });
});

describe("heightProximity", () => {
  it("is 1 at identical height, 0 at 12cm apart, clamps below", () => {
    expect(heightProximity(168, 168)).toBe(1);
    expect(heightProximity(168, 180)).toBe(0);
    expect(heightProximity(168, 156)).toBe(0);
    expect(heightProximity(168, 200)).toBe(0);
    expect(heightProximity(170, 176)).toBeCloseTo(0.5);
  });
});

describe("sizeProximity", () => {
  it("same=1, one apart=0.5, two+=0", () => {
    expect(sizeProximity("M", "M")).toBe(1);
    expect(sizeProximity("M", "L")).toBe(0.5);
    expect(sizeProximity("M", "S")).toBe(0.5);
    expect(sizeProximity("M", "XL")).toBe(0);
    expect(sizeProximity("XS", "XXL")).toBe(0);
  });
});

describe("fitOverlap", () => {
  const fh = (brand: string, verdict: FitHistory["verdict"]): FitHistory => ({
    id: "x",
    user_id: "u",
    brand,
    size: "M",
    verdict,
    source: "self_reported",
    created_at: "",
  });

  it("returns 0.5 when there is no brand overlap", () => {
    expect(fitOverlap([fh("Zara", "ran_small")], [fh("ASOS", "ran_large")])).toBe(
      0.5,
    );
  });
  it("returns 1 when every shared brand agrees", () => {
    expect(
      fitOverlap(
        [fh("Zara", "ran_small"), fh("ASOS", "true_to_size")],
        [fh("Zara", "ran_small"), fh("ASOS", "true_to_size")],
      ),
    ).toBe(1);
  });
  it("normalises partial agreement", () => {
    expect(
      fitOverlap(
        [fh("Zara", "ran_small"), fh("ASOS", "true_to_size")],
        [fh("Zara", "ran_small"), fh("ASOS", "ran_large")],
      ),
    ).toBe(0.5);
  });
  it("is case/space insensitive on brand", () => {
    expect(fitOverlap([fh(" zara ", "ran_small")], [fh("Zara", "ran_small")])).toBe(
      1,
    );
  });
});

describe("tierFor", () => {
  it("A>=0.8, B>=0.5, else C", () => {
    expect(tierFor(0.8)).toBe("A");
    expect(tierFor(0.79)).toBe("B");
    expect(tierFor(0.5)).toBe("B");
    expect(tierFor(0.49)).toBe("C");
  });
});

describe("matchScore", () => {
  it("identical bodies with no fit history score 0.925 (fit_overlap neutral)", () => {
    const r = matchScore(card({}), card({}), {
      viewerFitHistory: [],
      ownerFitHistory: [],
    });
    // 0.4*1 + 0.3*1 + 0.15*0.5 + 0.15*0.5 = 0.85 ... wait shape both null => 0.5
    expect(r.score).toBeCloseTo(0.4 + 0.3 + 0.15 * 0.5 + 0.15 * 0.5);
    expect(r.tier).toBe("A");
  });

  it("same shape tag lifts the score into clean Tier A", () => {
    const r = matchScore(
      card({ body_shape_tag: "hourglass" }),
      card({ body_shape_tag: "hourglass" }),
      { viewerFitHistory: [], ownerFitHistory: [] },
    );
    expect(r.score).toBeCloseTo(0.4 + 0.3 + 0.15 + 0.15 * 0.5);
  });

  it("far apart in height and size lands in Tier C", () => {
    const r = matchScore(
      card({ height_cm: 155, usual_size: "XS" }),
      card({ height_cm: 178, usual_size: "XL" }),
      { viewerFitHistory: [], ownerFitHistory: [] },
    );
    expect(r.tier).toBe("C");
  });

  it("weights sum to 1 (max possible score is 1)", () => {
    const r = matchScore(
      card({ body_shape_tag: "pear" }),
      card({ body_shape_tag: "pear" }),
      {
        viewerFitHistory: [
          {
            id: "1",
            user_id: "a",
            brand: "Zara",
            size: "M",
            verdict: "true_to_size",
            source: "purchase",
            created_at: "",
          },
        ],
        ownerFitHistory: [
          {
            id: "2",
            user_id: "b",
            brand: "Zara",
            size: "M",
            verdict: "true_to_size",
            source: "purchase",
            created_at: "",
          },
        ],
      },
    );
    expect(r.score).toBeCloseTo(1);
  });
});

describe("diffSentence", () => {
  it("exact match", () => {
    expect(diffSentence(card({}), card({}))).toBe("בדיוק הגובה והמידה שלך");
  });
  it("taller and one size up", () => {
    const s = diffSentence(card({}), card({ height_cm: 172, usual_size: "L" }));
    expect(s).toContain('גבוהה ממך ב-4 ס"מ');
    expect(s).toContain("מידה אחת מעליך");
  });
  it("shorter and smaller", () => {
    const s = diffSentence(card({}), card({ height_cm: 162, usual_size: "S" }));
    expect(s).toContain('נמוכה ממך ב-6 ס"מ');
    expect(s).toContain("מתחתיך");
  });
});
