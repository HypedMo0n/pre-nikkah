import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/require-user";

// §7.12's "Export my answers": every row here is scoped to the caller's
// own user_id under the same owner-only RLS the answers table always
// enforces — this route adds no new read path, it just formats one.
export async function GET() {
  const authenticated = await getAuthenticatedUser();
  if (!authenticated) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }
  const { supabase, user } = authenticated;

  const { data: answers, error } = await supabase
    .from("answers")
    .select("question_id, option_key, importance, private_note, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) {
    return NextResponse.json({ error: "EXPORT_FAILED" }, { status: 500 });
  }

  const questionIds = (answers ?? []).map((answer) => answer.question_id);
  const { data: questions } = await supabase.from("questions").select("id, topic_id, key, text").in("id", questionIds);
  const topicIds = [...new Set((questions ?? []).map((question) => question.topic_id))];
  const { data: topics } = await supabase.from("topics").select("id, title").in("id", topicIds);

  const questionById = new Map((questions ?? []).map((question) => [question.id, question]));
  const topicTitleById = new Map((topics ?? []).map((topic) => [topic.id, topic.title]));

  const exportRows = (answers ?? []).map((answer) => {
    const question = questionById.get(answer.question_id);
    return {
      topic: question ? (topicTitleById.get(question.topic_id) ?? null) : null,
      question: question?.text ?? null,
      questionKey: question?.key ?? null,
      option: answer.option_key,
      importance: answer.importance,
      privateNote: answer.private_note,
      answeredAt: answer.created_at,
      updatedAt: answer.updated_at,
    };
  });

  return NextResponse.json(
    { exportedAt: new Date().toISOString(), answers: exportRows },
    {
      headers: {
        "Content-Disposition": 'attachment; filename="my-answers.json"',
        "Content-Type": "application/json",
      },
    },
  );
}
