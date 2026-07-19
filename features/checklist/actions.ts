"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { parseLocale } from "@/lib/i18n/config";

const checklistItemSchema = z.object({
  checklistDefinitionId: z.string().uuid(),
  done: z.enum(["true", "false"]),
});

export async function setChecklistItemAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const parsed = checklistItemSchema.safeParse({
    checklistDefinitionId: formData.get("checklistDefinitionId"),
    done: formData.get("done"),
  });
  if (!parsed.success) return;

  const { supabase } = await requireAuthenticatedUser(locale);
  const { data: coupleId, error: coupleError } = await supabase.rpc(
    "current_couple_id",
  );
  if (coupleError || !coupleId) return;

  const done = parsed.data.done === "true";
  await supabase.from("couple_checklist_items").upsert(
    {
      checklist_definition_id: parsed.data.checklistDefinitionId,
      completed_at: done ? new Date().toISOString() : null,
      couple_id: coupleId,
      done,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "couple_id,checklist_definition_id" },
  );

  revalidatePath(`/${locale}/checklist`);
  revalidatePath(`/${locale}/dashboard`);
}
