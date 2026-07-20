import { createServerClient } from "@/lib/supabase/server";

export async function inspectInviteCode(inviteCode: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("inspect_couple_invite", {
    p_invite_code: inviteCode,
  });

  if (error) {
    return null;
  }

  return data;
}

export async function getCurrentCoupleId() {
  const supabase = await createServerClient();
  const { data } = await supabase.rpc("current_couple_id");
  return data;
}

export async function getWaitingCoupleId(userId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase.rpc("waiting_couple_id_for", {
    p_user_id: userId,
  });
  return data;
}
