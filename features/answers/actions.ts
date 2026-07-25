"use server";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { appendTraceId, logServerActionError } from "@/lib/logging/server-action-error";

import type { ComparisonReveal, SaveAnswerState } from "./types";
import { saveAnswerSchema } from "./validation";

export async function saveAnswerAction(
  _previousState: SaveAnswerState,
  formData: FormData,
): Promise<SaveAnswerState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = saveAnswerSchema.safeParse({
    questionId: formData.get("questionId"),
    optionKey: formData.get("optionKey"),
    importance: formData.get("importance"),
    privateNote: formData.get("privateNote"),
  });
  if (!parsed.success) {
    return { status: "error", message: translate(locale, "answer.invalid") };
  }
  const { questionId, optionKey, importance, privateNote } = parsed.data;

  const { supabase, user } = await requireAuthenticatedUser(locale);

  const { data: spaceId, error: spaceError } = await supabase.rpc("get_or_create_current_space");
  if (spaceError || !spaceId) {
    const traceId = logServerActionError({
      action: "answers.save_ensure_space",
      context: { questionId },
      error: spaceError,
      userId: user.id,
    });
    return { status: "error", message: appendTraceId(translate(locale, "auth.genericError"), traceId) };
  }

  const { error: upsertError } = await supabase.from("answers").upsert(
    {
      question_id: questionId,
      user_id: user.id,
      space_id: spaceId,
      option_key: optionKey,
      importance,
      private_note: privateNote,
    },
    { onConflict: "question_id,user_id,space_id" },
  );
  if (upsertError) {
    const traceId = logServerActionError({
      action: "answers.save",
      context: { questionId },
      error: upsertError,
      userId: user.id,
    });
    return { status: "error", message: appendTraceId(translate(locale, "auth.genericError"), traceId) };
  }

  // The AFTER INSERT/UPDATE trigger on answers has already run
  // refresh_comparison() synchronously by the time upsert() resolves, so
  // this read always sees the fresh row — including the 'pending' row it
  // writes on a first-ever answer to this question.
  const { data: comparison, error: comparisonError } = await supabase
    .from("comparisons")
    .select("state, priority, priority_driven_by")
    .eq("space_id", spaceId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (comparisonError) {
    const traceId = logServerActionError({
      action: "answers.save_read_comparison",
      context: { questionId },
      error: comparisonError,
      userId: user.id,
    });
    return { status: "error", message: appendTraceId(translate(locale, "auth.genericError"), traceId) };
  }

  const reveal: ComparisonReveal =
    !comparison || comparison.state === "pending"
      ? { kind: "waiting" }
      : {
          kind: "pattern",
          state: comparison.state,
          priority: comparison.priority,
          drivenBy:
            comparison.priority_driven_by === null
              ? null
              : comparison.priority_driven_by === user.id
                ? "me"
                : "partner",
        };

  return { status: "success", reveal };
}
