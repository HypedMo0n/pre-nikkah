import { ArrowRight, Check, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { estimateTopicMinutes } from "@/features/topics/timing";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type { QuestionType } from "@/types/domain";

export default async function TopicsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireAuthenticatedUser(locale);
  const [topicResult, questionResult, progressResult, discussionResult] = await Promise.all([
    supabase.from("topics").select("id,slug,name,blurb,order_index").eq("is_active", true).order("order_index"),
    supabase.from("questions").select("id,topic_id,type").eq("is_active", true),
    supabase.from("topic_progress").select("topic_id,user_id,completed_at"),
    supabase.from("guided_discussions").select("topic_id,status").eq("status", "discussed"),
  ]);
  const topics = topicResult.data ?? [];
  const questions = questionResult.data ?? [];
  const progress = progressResult.data ?? [];
  const discussedTopicIds = new Set((discussionResult.data ?? []).map((item) => item.topic_id));
  const d = getDictionary(locale);
  const labels = { empty: d["dashboard.notStarted"], completed: d["dashboard.completed"], discussed: d["dashboard.discussedState"] } as const;
  const icons = { empty: null, completed: Check, discussed: MessageCircle } as const;

  return (
    <OnboardingShell locale={locale} productive withTabBar>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{d["topics.eyebrow"]}</p>
      <h1 className="font-expressive mt-2 text-3xl font-medium text-ink">{d["topics.title"]}</h1>
      <div className="mt-6 space-y-3">
        {topics.map((topic) => {
          const types = questions.filter((question) => question.topic_id === topic.id).map((question) => question.type as QuestionType);
          const state = discussedTopicIds.has(topic.id)
            ? "discussed"
            : new Set(progress.filter((item) => item.topic_id === topic.id && item.completed_at).map((item) => item.user_id)).size >= 2
              ? "completed"
              : "empty";
          const StateIcon = icons[state];
          return (
            <Link
              className="flex min-h-20 items-center justify-between gap-4 rounded-productive border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={`${localizedPath(locale, "/topics")}/${topic.slug}`}
              key={topic.id}
            >
              <div>
                <h3 className="font-semibold text-ink">{topic.name}</h3>
                <p className="mt-1 text-sm text-ink-soft">{types.length} {d["topic.questions"]} · {estimateTopicMinutes(types)} {d["topic.minutes"]}</p>
                <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", state === "discussed" && "bg-accent/15 text-ink", state === "completed" && "bg-primary-soft text-primary", state === "empty" && "bg-background text-ink-soft")}>
                  {StateIcon ? <StateIcon aria-hidden="true" size={13} /> : null}
                  {labels[state]}
                </span>
              </div>
              <ArrowRight aria-hidden="true" className="shrink-0 text-ink-soft" size={18} />
            </Link>
          );
        })}
      </div>
    </OnboardingShell>
  );
}
