import { Check } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { getV3Copy } from "@/features/v3/copy";
import { getJourneyState } from "@/features/v3/data";
import { getCurrentTopicId } from "@/features/v3/progress";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";

export default async function TopicCompletePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const data = await getJourneyState(supabase, locale, user.id);
  const topic = data.content.topics.find((item) => item.slug === slug);
  if (!topic) notFound();
  const ids = new Set(
    data.content.questions
      .filter((question) => question.topicId === topic.id)
      .map((question) => question.id),
  );
  const ownCount = data.answers.filter(
    (answer) => answer.userId === user.id && ids.has(answer.questionId),
  ).length;
  if (ownCount < ids.size) {
    redirect(localizedPath(locale, `/topics/${slug}`));
  }
  const d = getV3Copy(locale);
  // "Waiting for partner" is a claim about the partner, and outside the
  // current shared topic this screen has no basis for it: the comparison rows
  // that would say otherwise are withheld by policy, so the partner may well
  // have finished this topic already.
  const isCurrentTopic =
    topic.id ===
    getCurrentTopicId(
      data.content.topics,
      data.progress,
      data.content.questions,
      new Set(data.discussions.map((discussion) => discussion.question_id)),
    );
  return (
    <OnboardingShell locale={locale}>
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-soft text-green">
          <Check aria-hidden="true" size={28} />
        </span>
        <h1 className="font-expressive mt-6 text-3xl font-medium text-ink">
          {topic.title}
        </h1>
        <p className="mt-3 leading-7 text-muted">
          {isCurrentTopic ? `${d.saved}. ${d.waiting}` : d.savedComparisonLater}
        </p>
        <Link
          className={buttonClasses({ className: "mt-8 w-full" })}
          href={localizedPath(locale, "/dashboard")}
        >
          {d.home}
        </Link>
      </div>
    </OnboardingShell>
  );
}
