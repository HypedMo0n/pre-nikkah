"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { parseLocale } from "@/lib/i18n/config";

import { discussionSchema } from "./validation";

export async function saveDiscussionAction(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const parsed = discussionSchema.safeParse({ questionId: formData.get("questionId"), sharedNote: formData.get("sharedNote") ?? "", status: formData.get("status") });
  if (!parsed.success) return;
  const { supabase } = await requireAuthenticatedUser(locale);
  const [{ data: coupleId, error: coupleError }, { data: question, error: questionError }] = await Promise.all([
    supabase.rpc("current_couple_id"),
    supabase.from("questions").select("topic_id").eq("id", parsed.data.questionId).single(),
  ]);
  if (coupleError || questionError || !coupleId || !question) return;
  await supabase.from("guided_discussions").upsert({
    couple_id: coupleId,
    topic_id: question.topic_id,
    question_id: parsed.data.questionId,
    shared_note: parsed.data.sharedNote || null,
    status: parsed.data.status,
  }, { onConflict: "couple_id,question_id" });
  revalidatePath(`/${locale}/conversations/${parsed.data.questionId}`);
  revalidatePath(`/${locale}/dashboard`);
}
