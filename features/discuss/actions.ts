"use server";

import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { safeReturnPath } from "@/lib/auth/paths";
import type { Locale } from "@/lib/i18n/config";
import { parseLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { appendTraceId, logServerActionError } from "@/lib/logging/server-action-error";

import type { DiscussActionState } from "./types";
import { addSharedNoteSchema, questionActionSchema } from "./validation";

function genericError(locale: Locale, traceId: string): DiscussActionState {
  return { status: "error", message: appendTraceId(translate(locale, "auth.genericError"), traceId) };
}

// §7.9: irreversible, so there is no undo action anywhere in this file —
// share_answer() itself is insert-only at the database layer (see
// migration 300's header comment).
export async function shareAnswerAction(
  _previousState: DiscussActionState,
  formData: FormData,
): Promise<DiscussActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = questionActionSchema.safeParse({ questionId: formData.get("questionId") });
  if (!parsed.success) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { error } = await supabase.rpc("share_answer", { p_question_id: parsed.data.questionId });
  if (error) {
    const traceId = logServerActionError({
      action: "discuss.share_answer",
      context: { questionId: parsed.data.questionId },
      error,
      userId: user.id,
    });
    return genericError(locale, traceId);
  }
  redirect(safeReturnPath(locale, formData.get("returnPath")));
}

export async function markDiscussedAction(
  _previousState: DiscussActionState,
  formData: FormData,
): Promise<DiscussActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = questionActionSchema.safeParse({ questionId: formData.get("questionId") });
  if (!parsed.success) {
    return { status: "error", message: translate(locale, "auth.genericError") };
  }
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: spaceId, error: spaceError } = await supabase.rpc("get_or_create_current_space");
  if (spaceError || !spaceId) {
    const traceId = logServerActionError({
      action: "discuss.mark_discussed_ensure_space",
      context: { questionId: parsed.data.questionId },
      error: spaceError,
      userId: user.id,
    });
    return genericError(locale, traceId);
  }
  const { error } = await supabase
    .from("discussions")
    .insert({ space_id: spaceId, question_id: parsed.data.questionId, discussed_by: user.id });
  if (error) {
    const traceId = logServerActionError({
      action: "discuss.mark_discussed",
      context: { questionId: parsed.data.questionId },
      error,
      userId: user.id,
    });
    return genericError(locale, traceId);
  }
  redirect(safeReturnPath(locale, formData.get("returnPath")));
}

export async function addSharedNoteAction(
  _previousState: DiscussActionState,
  formData: FormData,
): Promise<DiscussActionState> {
  const locale = parseLocale(formData.get("locale"));
  const parsed = addSharedNoteSchema.safeParse({
    questionId: formData.get("questionId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { status: "error", message: translate(locale, "discuss.noteInvalid") };
  }
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: spaceId, error: spaceError } = await supabase.rpc("get_or_create_current_space");
  if (spaceError || !spaceId) {
    const traceId = logServerActionError({
      action: "discuss.add_note_ensure_space",
      context: { questionId: parsed.data.questionId },
      error: spaceError,
      userId: user.id,
    });
    return genericError(locale, traceId);
  }
  const { error } = await supabase.from("shared_notes").insert({
    space_id: spaceId,
    question_id: parsed.data.questionId,
    author_id: user.id,
    body: parsed.data.body,
  });
  if (error) {
    const traceId = logServerActionError({
      action: "discuss.add_note",
      context: { questionId: parsed.data.questionId },
      error,
      userId: user.id,
    });
    return genericError(locale, traceId);
  }
  redirect(safeReturnPath(locale, formData.get("returnPath")));
}
