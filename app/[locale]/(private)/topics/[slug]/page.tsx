import { Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { estimateTopicMinutes } from "@/features/topics/timing";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { QuestionType } from "@/types/domain";

export default async function TopicIntroductionPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: topic } = await supabase.from("topics").select("id,name,blurb").eq("slug", slug).eq("is_active", true).single();
  if (!topic) notFound();
  const [{ data: questions }, { data: answers }] = await Promise.all([
    supabase.from("questions").select("id,type,order_index").eq("topic_id", topic.id).eq("is_active", true).order("order_index"),
    supabase.from("answers").select("question_id").eq("user_id", user.id),
  ]);
  const answeredIds = new Set((answers ?? []).map((answer) => answer.question_id));
  const nextQuestion = (questions ?? []).find((question) => !answeredIds.has(question.id)) ?? questions?.[0];
  if (!nextQuestion) notFound();
  const d = getDictionary(locale);
  return (
    <OnboardingShell backHref={localizedPath(locale, "/dashboard")} locale={locale}>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{questions?.length ?? 0} {d["topic.questions"]} · {estimateTopicMinutes((questions ?? []).map((question) => question.type as QuestionType))} {d["topic.minutes"]}</p>
      <h1 className="font-expressive mt-3 text-4xl font-medium text-ink">{topic.name}</h1>
      <p className="mt-4 text-lg leading-8 text-body">{topic.blurb}</p>
      <p className="mt-7 flex items-start gap-3 rounded-productive border bg-primary-soft p-4 text-sm leading-6 text-primary"><Lock aria-hidden="true" className="mt-0.5 shrink-0" size={17} />{d["topic.privacy"]}</p>
      <Link className={buttonClasses({ className: "mt-8 w-full" })} href={`${localizedPath(locale, `/topics/${slug}/questions`)}/${nextQuestion.id}`}>{answeredIds.size ? d["topic.resume"] : d["topic.begin"]}</Link>
    </OnboardingShell>
  );
}
