import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type { SpaceInviteInspection } from "./types";

const inspectionSchema = z.union([
  z.object({ status: z.literal("available"), expiresAt: z.string() }),
  z.object({ status: z.enum(["unavailable", "self_invite", "active_space_conflict"]) }),
]);

export async function inspectSpaceInvite(code: string): Promise<SpaceInviteInspection> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inspect_space_invite", { p_invite_code: code });
  if (error || !data) {
    return { status: "unavailable" };
  }
  const parsed = inspectionSchema.safeParse(data);
  return parsed.success ? parsed.data : { status: "unavailable" };
}
