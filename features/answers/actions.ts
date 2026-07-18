"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { parseLocale } from "@/lib/i18n/config";

const revealSchema = z.object({ questionId: z.string().uuid(), revealed: z.enum(["true", "false"]) });

export async function setOwnAnswerRevealAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const parsed = revealSchema.safeParse({ questionId: formData.get("questionId"), revealed: formData.get("revealed") });
  if (!parsed.success) return;
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: ownedAnswer, error: readError } = await supabase.from("answers").select("id").eq("user_id", user.id).eq("question_id", parsed.data.questionId).maybeSingle();
  if (readError || !ownedAnswer) return;
  const shouldReveal = parsed.data.revealed === "true";
  await supabase.from("answers").update({ revealed: shouldReveal, revealed_at: shouldReveal ? new Date().toISOString() : null }).eq("id", ownedAnswer.id).eq("user_id", user.id);
  revalidatePath(`/${locale}/comparisons`);
  revalidatePath(`/${locale}/conversations/${parsed.data.questionId}`);
}
