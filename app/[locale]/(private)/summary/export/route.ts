import { NextResponse } from "next/server";

import { getJourneyState } from "@/features/v3/data";
import { getCurrentTopicId, toVisibleProgress } from "@/features/v3/progress";
import { getAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const authenticated = await getAuthenticatedUser();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = authenticated;
  const data = await getJourneyState(supabase, locale, user.id);
  const ownAnswers = data.answers.filter(
    (answer) => answer.userId === user.id,
  );
  const answerIds = ownAnswers.map((answer) => answer.id);
  const { data: privateNotes } = answerIds.length
    ? await supabase
        .from("private_answer_notes")
        .select("answer_id,body,updated_at")
        .in("answer_id", answerIds)
    : { data: [] };
  const noteMap = new Map(
    (privateNotes ?? []).map((note) => [note.answer_id, note]),
  );
  const currentTopicId = getCurrentTopicId(
    data.content.topics,
    data.progress,
    data.content.questions,
    new Set(data.discussions.map((discussion) => discussion.question_id)),
  );

  const record = {
    // 2: partnerAnswered and readyTogether are null rather than a number for
    // every topic except the current shared one, so a version-1 importer doing
    // arithmetic on them would break. The shape change gets its own version.
    version: 2,
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Private reflection record. Not religious, legal, medical, psychological, or compatibility advice.",
    privacy:
      "Contains the requesting user's exact answers and private notes, neutral server comparisons, and intentionally shared notes. It excludes the partner's unshared exact answers and all partner private notes.",
    space: {
      status: data.overview.status,
      partnerDisplayName: data.overview.partner?.displayName ?? null,
    },
    topics: data.content.topics.map((topic) => {
      const progress = data.progress.find((item) => item.topicId === topic.id);
      // Per-topic partner counts would show which subjects the partner has not
      // finished, and an export persists that in a file. Only the current
      // shared topic carries them, matching what the screens show.
      const visible = progress
        ? toVisibleProgress(progress, topic.id === currentTopicId)
        : null;
      return {
        title: topic.title,
        ownAnswered: visible?.own ?? 0,
        partnerAnswered: visible?.partner ?? null,
        readyTogether: visible?.together ?? null,
        totalQuestions: visible?.total ?? 0,
      };
    }),
    ownAnswers: ownAnswers.map((answer) => {
      const question = data.content.questions.find(
        (item) => item.id === answer.questionId,
      );
      const option = question?.options.find(
        (item) => item.key === answer.optionKey,
      );
      return {
        question: question?.text ?? "Question unavailable",
        answer: option?.label ?? answer.optionKey,
        importance: answer.importance,
        privateNote: noteMap.get(answer.id)?.body ?? null,
        updatedAt: answer.updatedAt,
      };
    }),
    comparisons: data.comparisons.map((comparison) => ({
      question:
        data.content.questions.find(
          (item) => item.id === comparison.questionId,
        )?.text ?? "Question unavailable",
      state: comparison.state,
      priority: comparison.priority,
      discussed: data.discussions.some(
        (discussion) => discussion.question_id === comparison.questionId,
      ),
      computedAt: comparison.computedAt,
    })),
    sharedNotes: data.sharedNotes.map((note) => ({
      question:
        data.content.questions.find((item) => item.id === note.question_id)
          ?.text ?? "Question unavailable",
      body: note.body,
      createdAt: note.created_at,
    })),
  };

  return NextResponse.json(record, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition":
        'attachment; filename="together-in-amanah-record.json"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}
