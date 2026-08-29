"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getItem, getUser, toggleFollow, toggleLike } from "@/lib/db/repo";

export async function toggleFollowAction(
  followeeId: string,
): Promise<{ ok: boolean; following: boolean }> {
  const user = await requireUser();
  if (user.id === followeeId) return { ok: false, following: false };
  if (!getUser(followeeId)) return { ok: false, following: false };
  const following = toggleFollow(user.id, followeeId);
  revalidatePath(`/u/${followeeId}`);
  return { ok: true, following };
}

export async function toggleLikeAction(
  itemId: string,
): Promise<{ ok: boolean; liked: boolean }> {
  const user = await requireUser();
  if (!getItem(itemId)) return { ok: false, liked: false };
  const liked = toggleLike(user.id, itemId);
  revalidatePath("/");
  revalidatePath(`/item/${itemId}`);
  revalidatePath("/likes");
  return { ok: true, liked };
}
