import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/lib/i18n/config";
import type { Database } from "@/types/database";

import type {
  Importance,
  JourneyAnswer,
  JourneyComparison,
  JourneyContent,
  QuestionContent,
  SpaceOverview,
  TopicProgress,
} from "./types";

type Client = SupabaseClient<Database>;

function pickTranslation<T extends { locale: string }>(
  translations: readonly T[],
  locale: Locale,
) {
  return (
    translations.find((item) => item.locale === locale) ??
    translations.find((item) => item.locale === "en")
  );
}

export function parseSpaceOverview(value: unknown): SpaceOverview {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return { status: "none" };
  }
  const record = value as Record<string, unknown>;
  const status = ["none", "waiting", "active", "paused"].includes(String(record.status))
    ? (String(record.status) as SpaceOverview["status"])
    : "none";
  const partner =
    record.partner && typeof record.partner === "object"
      ? {
          id: String((record.partner as Record<string, unknown>).id ?? ""),
          displayName: String(
            (record.partner as Record<string, unknown>).displayName ?? "",
          ),
        }
      : null;
  return {
    status,
    spaceId: typeof record.spaceId === "string" ? record.spaceId : undefined,
    role:
      record.role === "creator" || record.role === "partner"
        ? record.role
        : undefined,
    inviteExpiresAt:
      typeof record.inviteExpiresAt === "string"
        ? record.inviteExpiresAt
        : null,
    partner,
  };
}

export async function getSpaceOverview(client: Client) {
  const { data, error } = await client.rpc("get_space_overview");
  if (error) throw error;
  return parseSpaceOverview(data);
}

export async function getJourneyContent(
  client: Client,
  locale: Locale,
): Promise<JourneyContent> {
  const locales = locale === "en" ? ["en"] : [locale, "en"];
  const [
    topicResult,
    topicTranslationResult,
    questionResult,
    questionTranslationResult,
    optionResult,
    optionTranslationResult,
  ] = await Promise.all([
    client.from("topics").select("id,slug,order_index").order("order_index"),
    client
      .from("topic_translations")
      .select("topic_id,locale,title,subtitle")
      .in("locale", locales),
    client
      .from("questions")
      .select("id,key,topic_id,order_index,default_importance")
      .order("order_index"),
    client
      .from("question_translations")
      .select("question_id,locale,text,starter_aligned,starter_discuss")
      .in("locale", locales),
    client
      .from("question_options")
      .select("question_id,key,cluster,order_index")
      .order("order_index"),
    client
      .from("question_option_translations")
      .select("question_id,option_key,locale,label,description")
      .in("locale", locales),
  ]);

  const firstError = [
    topicResult.error,
    topicTranslationResult.error,
    questionResult.error,
    questionTranslationResult.error,
    optionResult.error,
    optionTranslationResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const topicTranslations = topicTranslationResult.data ?? [];
  const questionTranslations = questionTranslationResult.data ?? [];
  const optionTranslations = optionTranslationResult.data ?? [];
  const options = optionResult.data ?? [];

  const topics = (topicResult.data ?? []).map((topic) => {
    const translation = pickTranslation(
      topicTranslations.filter((item) => item.topic_id === topic.id),
      locale,
    );
    return {
      id: topic.id,
      slug: topic.slug,
      orderIndex: topic.order_index,
      title: translation?.title ?? topic.slug,
      subtitle: translation?.subtitle ?? "",
    };
  });

  const questions: QuestionContent[] = (questionResult.data ?? []).map(
    (question) => {
      const translation = pickTranslation(
        questionTranslations.filter(
          (item) => item.question_id === question.id,
        ),
        locale,
      );
      return {
        id: question.id,
        key: question.key,
        topicId: question.topic_id,
        orderIndex: question.order_index,
        defaultImportance: question.default_importance as Importance,
        text: translation?.text ?? question.key,
        starterAligned: translation?.starter_aligned ?? "",
        starterDiscuss: translation?.starter_discuss ?? "",
        options: options
          .filter((option) => option.question_id === question.id)
          .map((option) => {
            const optionTranslation = pickTranslation(
              optionTranslations.filter(
                (item) =>
                  item.question_id === option.question_id &&
                  item.option_key === option.key,
              ),
              locale,
            );
            return {
              key: option.key,
              cluster: option.cluster,
              orderIndex: option.order_index,
              label: optionTranslation?.label ?? option.key,
              description: optionTranslation?.description ?? "",
            };
          }),
      };
    },
  );

  return { topics, questions };
}

export async function getJourneyState(
  client: Client,
  locale: Locale,
  userId: string,
) {
  const [overview, content] = await Promise.all([
    getSpaceOverview(client),
    getJourneyContent(client, locale),
  ]);

  if (!overview.spaceId) {
    return {
      overview,
      content,
      answers: [] as JourneyAnswer[],
      comparisons: [] as JourneyComparison[],
      discussions: [],
      sharedNotes: [],
      shares: [],
      events: [],
      eventReads: [],
      progress: content.topics.map(
        (topic): TopicProgress => ({
          topicId: topic.id,
          own: 0,
          partner: 0,
          total: content.questions.filter(
            (question) => question.topicId === topic.id,
          ).length,
          together: 0,
        }),
      ),
    };
  }

  const spaceId = overview.spaceId;
  const [
    answerResult,
    comparisonResult,
    discussionResult,
    sharedNoteResult,
    shareResult,
    eventResult,
    eventReadResult,
    progressResults,
  ] = await Promise.all([
    client
      .from("answers")
      .select("id,question_id,user_id,option_key,importance,updated_at")
      .eq("space_id", spaceId),
    client
      .from("comparisons")
      .select(
        "question_id,state,priority,high_priority_user_ids,computed_at",
      )
      .eq("space_id", spaceId),
    client
      .from("discussions")
      .select("question_id,discussed_at,discussed_by")
      .eq("space_id", spaceId),
    client
      .from("shared_notes")
      .select("id,question_id,author_id,body,created_at")
      .eq("space_id", spaceId)
      .order("created_at"),
    client
      .from("answer_shares")
      .select("answer_id,shared_with_user_id,shared_at"),
    client
      .from("space_events")
      .select("id,actor_id,kind,payload_json,created_at")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false }),
    client
      .from("event_reads")
      .select("space_event_id,user_id,read_at")
      .eq("user_id", userId),
    Promise.all(
      content.topics.map((topic) =>
        client.rpc("get_topic_progress", {
          p_space_id: spaceId,
          p_topic_id: topic.id,
        }),
      ),
    ),
  ]);

  const firstError = [
    answerResult.error,
    comparisonResult.error,
    discussionResult.error,
    sharedNoteResult.error,
    shareResult.error,
    eventResult.error,
    eventReadResult.error,
    ...progressResults.map((result) => result.error),
  ].find(Boolean);
  if (firstError) throw firstError;

  const answers: JourneyAnswer[] = (answerResult.data ?? []).map((answer) => ({
    id: answer.id,
    questionId: answer.question_id,
    userId: answer.user_id,
    optionKey: answer.option_key,
    importance: answer.importance as Importance,
    updatedAt: answer.updated_at,
  }));
  const comparisons: JourneyComparison[] = (comparisonResult.data ?? []).map(
    (comparison) => ({
      questionId: comparison.question_id,
      state: comparison.state as JourneyComparison["state"],
      priority: comparison.priority as Importance,
      highPriorityUserIds: comparison.high_priority_user_ids,
      computedAt: comparison.computed_at,
    }),
  );

  const progress = content.topics.map((topic, index): TopicProgress => {
    const rows = progressResults[index].data ?? [];
    const own = rows.find((row) => row.user_id === userId)?.answered_count ?? 0;
    const partner =
      rows.find((row) => row.user_id !== userId)?.answered_count ?? 0;
    const topicQuestionIds = new Set(
      content.questions
        .filter((question) => question.topicId === topic.id)
        .map((question) => question.id),
    );
    return {
      topicId: topic.id,
      own: Number(own),
      partner: Number(partner),
      total: Number(rows[0]?.question_count ?? topicQuestionIds.size),
      together: comparisons.filter(
        (comparison) =>
          topicQuestionIds.has(comparison.questionId) &&
          comparison.state !== "pending",
      ).length,
    };
  });

  return {
    overview,
    content,
    answers,
    comparisons,
    discussions: discussionResult.data ?? [],
    sharedNotes: sharedNoteResult.data ?? [],
    shares: shareResult.data ?? [],
    events: eventResult.data ?? [],
    eventReads: eventReadResult.data ?? [],
    progress,
  };
}
