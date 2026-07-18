import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import type { Locale } from "@/lib/i18n/config";

import { questionComparisonSchema, topicComparisonSummarySchema } from "./types";

export async function getQuestionComparison(locale: Locale, questionId: string) {
  const { supabase } = await requireAuthenticatedUser(locale);
  const { data, error } = await supabase.rpc("get_question_comparison", { p_question_id: questionId });
  const parsed = questionComparisonSchema.safeParse(data?.[0]);
  if (error || !parsed.success) throw new Error("SAFE_COMPARISON_UNAVAILABLE");
  return parsed.data;
}

export async function getTopicComparisonSummary(locale: Locale, topicId: string) {
  const { supabase } = await requireAuthenticatedUser(locale);
  const { data, error } = await supabase.rpc("get_topic_comparison_summary", { p_topic_id: topicId });
  const parsed = topicComparisonSummarySchema.safeParse(data);
  if (error || !parsed.success) throw new Error("SAFE_COMPARISON_UNAVAILABLE");
  return parsed.data;
}
