import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getUser } from "./db/repo";
import type { User } from "./types";

const COOKIE = "closet_session";
const DEV_SECRET = "pilot-dev-secret-change-in-production";
const SECRET = process.env.SESSION_SECRET ?? DEV_SECRET;

// Checked at request time (not build time) so `next build` doesn't need it.
function assertSecret() {
  if (
    SECRET === DEV_SECRET &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error(
      "SESSION_SECRET must be set in production (a long random string, e.g. `openssl rand -hex 32`).",
    );
  }
}

function sign(value: string): string {
  const mac = crypto.createHmac("sha256", SECRET).update(value).digest("hex");
  return `${value}.${mac}`;
}
function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(value)
    .digest("hex");
  const ok =
    mac.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  return ok ? value : null;
}

export async function setSession(userId: string): Promise<void> {
  assertSecret();
  const jar = await cookies();
  jar.set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  assertSecret();
  const jar = await cookies();
  return verify(jar.get(COOKIE)?.value);
}

export async function getCurrentUser(): Promise<User | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  const u = getUser(id);
  if (!u || u.is_suspended) return null;
  return u;
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!u.is_admin) throw new Error("FORBIDDEN");
  return u;
}
