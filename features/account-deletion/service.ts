import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteVerifiedAuthenticatedAccount(verifiedUserId: string) {
  const admin = createAdminClient();
  const { error: preparationError } = await admin.rpc("prepare_account_deletion", { p_user_id: verifiedUserId });
  if (preparationError) throw new Error("ACCOUNT_DELETION_FAILED");
  const { error: deletionError } = await admin.auth.admin.deleteUser(verifiedUserId);
  if (deletionError) throw new Error("ACCOUNT_DELETION_FAILED");
}
