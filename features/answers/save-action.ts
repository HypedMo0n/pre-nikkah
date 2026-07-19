"use server";

import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import {
  appendTraceId,
  logServerActionError,
} from "@/lib/logging/server-action-error";

export type AnswerSaveState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: string; savedValue?: string };
export const initialAnswerSaveState: AnswerSaveState = { status: "idle" };

const inputSchema = z.object({ questionId: z.string().uuid(), value: z.string().max(4000) });

export async function saveAnswerAction(previous: AnswerSaveState, formData: FormData): Promise<AnswerSaveState> {
  const locale = parseLocale(formData.get("locale"));
  const fail = (traceId?: string): AnswerSaveState => {
    const message = translate(locale, "status.error");
    return {
      status: "error",
      message: traceId ? appendTraceId(message, traceId) : message,
      savedValue: previous.savedValue,
    };
  };
  const parsed = inputSchema.safeParse({ questionId: formData.get("questionId"), value: formData.get("value") });
  if (!parsed.success) return fail();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const [{ data: question, error: questionError }, { data: coupleId, error: coupleError }] = await Promise.all([
    supabase.from("questions").select("id,topic_id,type,options").eq("id", parsed.data.questionId).eq("is_active", true).single(),
    supabase.rpc("current_couple_id"),
  ]);
  if (questionError || coupleError || !question || !coupleId) {
    const traceId = logServerActionError({
      action: "answer.load_context",
      context: { coupleId, questionId: parsed.data.questionId },
      error: questionError ?? coupleError,
      userId: user.id,
    });
    return fail(traceId);
  }

  let value: string | number = parsed.data.value.trim();
  if (question.type === "scale") {
    const numeric = Number(parsed.data.value);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) return fail();
    value = numeric;
  } else if (question.type === "single") {
    const options = z.array(z.object({ id: z.string(), label: z.string() })).safeParse(question.options);
    if (!options.success || !options.data.some((option) => option.id === value)) return fail();
  } else if (!value) {
    return fail();
  }

  const { error } = await supabase.from("answers").upsert({ couple_id: coupleId, question_id: question.id, user_id: user.id, value }, { onConflict: "question_id,user_id,couple_id" });
  if (error) {
    const traceId = logServerActionError({
      action: "answer.save",
      context: {
        coupleId,
        questionId: question.id,
        topicId: question.topic_id,
      },
      error,
      userId: user.id,
    });
    return fail(traceId);
  }

  const [{ count: questionCount }, { count: answerCount }] = await Promise.all([
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("topic_id", question.topic_id).eq("is_active", true),
    supabase.from("answers").select("id,questions!inner(topic_id)", { count: "exact", head: true }).eq("user_id", user.id).eq("couple_id", coupleId).eq("questions.topic_id", question.topic_id),
  ]);
  if (questionCount && answerCount === questionCount) {
    const { error: progressError } = await supabase.from("topic_progress").upsert({ couple_id: coupleId, topic_id: question.topic_id, user_id: user.id, completed_at: new Date().toISOString() }, { onConflict: "couple_id,topic_id,user_id" });
    if (progressError) {
      const traceId = logServerActionError({
        action: "answer.complete_topic",
        context: { coupleId, questionId: question.id, topicId: question.topic_id },
        error: progressError,
        userId: user.id,
      });
      return fail(traceId);
    }
  }
  return { status: "saved", message: translate(locale, "status.saved"), savedAt: new Date().toISOString(), savedValue: parsed.data.value.trim() };
}
