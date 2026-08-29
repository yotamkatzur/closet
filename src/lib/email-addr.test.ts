import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email-addr";

describe("normalizeEmail", () => {
  it("lower-cases and trims", () => {
    expect(normalizeEmail("  Yotam.K@Gmail.com ")).toBe("yotam.k@gmail.com");
  });

  it("accepts plus-addressing and subdomains", () => {
    expect(normalizeEmail("a+b@mail.example.co.il")).toBe(
      "a+b@mail.example.co.il",
    );
  });

  it("rejects malformed addresses", () => {
    for (const bad of ["", "nope", "a@b", "a @b.com", "a@b .com", "@b.com", "a@"])
      expect(normalizeEmail(bad)).toBeNull();
  });
});
