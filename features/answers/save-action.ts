"use server";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { localizedPath, parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import {
  appendTraceId,
  logServerActionError,
} from "@/lib/logging/server-action-error";

import type { AnswerSaveState } from "./types";
import { answerInputSchema, answerOptionsSchema } from "./validation";

import { getConnectionStatus, journeyRequiredState, logAnswerContextUnavailable } from "./journey-state";
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
  const parsed = answerInputSchema.safeParse({
    questionId: formData.get("questionId"),
    value: formData.get("value"),
    importance: formData.get("importance") || undefined,
  });
  if (!parsed.success) return fail();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const [{ data: question, error: questionError }, { data: coupleId, error: coupleError }] = await Promise.all([
    supabase.from("questions").select("id,topic_id,type,options").eq("id", parsed.data.questionId).eq("is_active", true).maybeSingle(),
    supabase.rpc("current_couple_id"),
  ]);
  if (questionError) {
    const traceId = logServerActionError({
      action: "answer.load_question",
      context: { questionId: parsed.data.questionId },
      error: questionError,
      userId: user.id,
    });
    return fail(traceId);
  }
  if (coupleError) {
    const traceId = logServerActionError({
      action: "answer.load_journey",
      context: { questionId: parsed.data.questionId },
      error: coupleError,
      userId: user.id,
    });
    return fail(traceId);
  }
  if (!question) {
    return {
      status: "question_unavailable",
      message: translate(locale, "answer.questionUnavailable"),
      redirectTo: localizedPath(locale, "/dashboard"),
      savedValue: previous.savedValue,
    };
  }
  if (!coupleId) {
    const { data: overview, error: overviewError } = await supabase.rpc("get_connection_overview");
    if (overviewError) {
      const traceId = logServerActionError({
        action: "answer.load_journey_overview",
        context: { questionId: parsed.data.questionId },
        error: overviewError,
        userId: user.id,
      });
      return fail(traceId);
    }
    const connectionStatus = getConnectionStatus(overview);
    logAnswerContextUnavailable({
      connectionStatus,
      questionId: parsed.data.questionId,
      reason: "no_current_journey",
      userId: user.id,
    });
    if (connectionStatus === "active") {
      const traceId = logServerActionError({
        action: "answer.journey_invariant",
        context: { questionId: parsed.data.questionId },
        error: { message: `current_couple_id null with ${connectionStatus} overview` },
        userId: user.id.slice(0, 8),
      });
      return fail(traceId);
    }
    return journeyRequiredState(locale, connectionStatus, previous.savedValue);
  }

  let value: string | number = parsed.data.value.trim();
  if (question.type === "scale") {
    const numeric = Number(parsed.data.value);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) return fail();
    value = numeric;
  } else if (question.type === "single") {
    const options = answerOptionsSchema.safeParse(question.options);
    if (!options.success || !options.data.some((option) => option.id === value)) return fail();
  } else if (!value) {
    return fail();
  }

  const { error } = await supabase.from("answers").upsert({
    couple_id: coupleId,
    question_id: question.id,
    user_id: user.id,
    value,
    importance: parsed.data.importance ?? "flexible",
  }, { onConflict: "question_id,user_id,couple_id" });
  if (error) {
    // PGRST204 means PostgREST's schema cache has no such column — the
    // deployed database is missing a migration the application code
    // already expects. Retrying cannot fix this, so it gets a distinct
    // action name (for log-based alerting) and an honest message instead
    // of the generic retry prompt.
    const isSchemaCacheMiss = error.code === "PGRST204";
    const traceId = logServerActionError({
      action: isSchemaCacheMiss ? "answer.save.schema_cache_miss" : "answer.save",
      context: {
        coupleId,
        questionId: question.id,
        topicId: question.topic_id,
      },
      error,
      userId: user.id,
    });
    if (isSchemaCacheMiss) {
      return {
        status: "error",
        message: appendTraceId(translate(locale, "status.errorUnavailable"), traceId),
        savedValue: previous.savedValue,
      };
    }
    return fail(traceId);
  }

  const [
    { count: questionCount, error: questionCountError },
    { count: answerCount, error: answerCountError },
  ] = await Promise.all([
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("topic_id", question.topic_id).eq("is_active", true),
    supabase.from("answers").select("id,questions!inner(topic_id,is_active)", { count: "exact", head: true }).eq("user_id", user.id).eq("couple_id", coupleId).eq("questions.topic_id", question.topic_id).eq("questions.is_active", true),
  ]);
  if (questionCountError || answerCountError) {
    const traceId = logServerActionError({
      action: "answer.count_progress",
      context: { coupleId, questionId: question.id, topicId: question.topic_id },
      error: questionCountError ?? answerCountError,
      userId: user.id,
    });
    return fail(traceId);
  }
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
