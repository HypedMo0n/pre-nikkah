import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const authenticated = await getAuthenticatedUser();
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase } = authenticated;
  const [topicsResult, questionsResult, progressResult, discussionsResult, definitionsResult, checklistResult] = await Promise.all([
    supabase.from("topics").select("id,name,order_index").eq("is_active", true).order("order_index"),
    supabase.from("questions").select("id,text,topic_id,order_index").eq("is_active", true),
    supabase.from("topic_progress").select("topic_id,completed_at"),
    supabase.from("guided_discussions").select("question_id,status,shared_note,updated_at"),
    supabase.from("checklist_definitions").select("id,label,order_index").eq("is_active", true).order("order_index"),
    supabase.from("couple_checklist_items").select("checklist_definition_id,done,completed_at"),
  ]);
  if ([topicsResult, questionsResult, progressResult, discussionsResult, definitionsResult, checklistResult].some((result) => result.error)) {
    return NextResponse.json({ error: "Summary unavailable" }, { status: 503 });
  }
  const questions = new Map((questionsResult.data ?? []).map((question) => [question.id, question]));
  const checklistState = new Map((checklistResult.data ?? []).map((item) => [item.checklist_definition_id, item]));
  const summary = {
    generatedAt: new Date().toISOString(),
    disclaimer: "Discussion summary. Not religious, psychological, or legal advice.",
    privacy: "This export intentionally excludes all raw answers, including revealed answers.",
    topics: (topicsResult.data ?? []).map((topic) => ({
      name: topic.name,
      participantCompletions: (progressResult.data ?? []).filter((progress) => progress.topic_id === topic.id && progress.completed_at).length,
    })),
    discussions: (discussionsResult.data ?? []).map((discussion) => ({
      question: questions.get(discussion.question_id)?.text ?? "Question unavailable",
      status: discussion.status,
      sharedNote: discussion.shared_note,
      updatedAt: discussion.updated_at,
    })),
    checklist: (definitionsResult.data ?? []).map((definition) => ({
      label: definition.label,
      done: checklistState.get(definition.id)?.done ?? false,
      completedAt: checklistState.get(definition.id)?.completed_at ?? null,
    })),
  };
  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="discussion-summary.json"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}
