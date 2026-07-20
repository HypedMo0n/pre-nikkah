import "server-only";

import { logServerActionError } from "@/lib/logging/server-action-error";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteVerifiedAuthenticatedAccount(verifiedUserId: string) {
  const admin = createAdminClient();
  const { error: preparationError } = await admin.rpc("prepare_account_deletion", { p_user_id: verifiedUserId });
  if (preparationError) {
    const traceId = logServerActionError({
      action: "account_deletion.prepare",
      error: preparationError,
      userId: verifiedUserId,
    });
    throw new Error(`ACCOUNT_DELETION_FAILED:${traceId}`);
  }
  const { error: deletionError } = await admin.auth.admin.deleteUser(verifiedUserId);
  if (deletionError) {
    const traceId = logServerActionError({
      action: "account_deletion.delete_auth_user",
      error: deletionError,
      userId: verifiedUserId,
    });
    throw new Error(`ACCOUNT_DELETION_FAILED:${traceId}`);
  }
}
