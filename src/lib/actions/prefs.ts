"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setShowAllSizes(value: boolean): Promise<void> {
  const jar = await cookies();
  jar.set("show_all_sizes", value ? "1" : "0", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/");
}
