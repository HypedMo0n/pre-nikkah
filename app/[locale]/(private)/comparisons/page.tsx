import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Card } from "@/components/ui/card";
import { getQuestionComparison } from "@/features/comparisons/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ComparisonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireAuthenticatedUser(locale);
  const [{ data: questions }, { data: topics }] = await Promise.all([
    supabase.from("questions").select("id,text,topic_id,order_index").eq("is_active", true).order("order_index"),
    supabase.from("topics").select("id,name,order_index").eq("is_active", true).order("order_index"),
  ]);
  const rows = await Promise.all((questions ?? []).map(async (question) => {
    try { return { question, comparison: await getQuestionComparison(locale, question.id) }; } catch { return { question, comparison: null }; }
  }));
  const d = getDictionary(locale);
  const labels = { aligned: d["comparison.aligned"], worth_discussing: d["comparison.worth"], possible_concern: d["comparison.concern"] } as const;
  const toneClasses = {
    aligned: "bg-aligned",
    possible_concern: "bg-concern",
    worth_discussing: "bg-discuss",
  } as const;
  return (
    <OnboardingShell backHref={localizedPath(locale, "/dashboard")} locale={locale} productive>
      <h1 className="font-expressive text-3xl font-medium text-ink">{d["comparison.title"]}</h1>
      <p className="mt-3 text-sm leading-6 text-body">{d["comparison.body"]}</p>
      <div className="mt-7 space-y-8">
        {(topics ?? []).map((topic) => {
          const topicRows = rows.filter(({ question }) => question.topic_id === topic.id);
          const counts = topicRows.reduce(
            (summary, { comparison }) => {
              if (!comparison || comparison.status !== "ready") summary.waiting += 1;
              else summary[comparison.bucket] += 1;
              return summary;
            },
            { aligned: 0, possible_concern: 0, waiting: 0, worth_discussing: 0 },
          );
          return (
            <section aria-labelledby={`topic-${topic.id}`} key={topic.id}>
              <h2 className="text-xl font-semibold text-ink" id={`topic-${topic.id}`}>{topic.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {counts.aligned} {d["comparison.aligned"].toLocaleLowerCase(locale)} · {counts.worth_discussing} {d["comparison.worth"].toLocaleLowerCase(locale)} · {counts.possible_concern} {d["comparison.concern"].toLocaleLowerCase(locale)} · {counts.waiting} {d["comparison.waiting"].toLocaleLowerCase(locale)}
              </p>
              <div className="mt-3 space-y-3">
                {topicRows.map(({ question, comparison }) => {
                  const status = !comparison
                    ? d["comparison.unavailable"]
                    : comparison.status === "ready"
                      ? labels[comparison.bucket]
                      : comparison.status === "waiting_for_you"
                        ? d["comparison.waitingYou"]
                        : d["comparison.waitingPartner"];
                  const tone = comparison?.status === "ready" ? toneClasses[comparison.bucket] : "bg-ink-soft";
                  return (
                    <Card className="p-4" key={question.id}>
                      <h3 className="font-semibold leading-6 text-ink">{question.text}</h3>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm text-body"><span className={`size-2 shrink-0 rounded-full ${tone}`} aria-hidden="true" />{status}</span>
                        {comparison?.status === "ready" && <Link aria-label={`${d["comparison.open"]}: ${question.text}`} className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink" href={`${localizedPath(locale, "/conversations")}/${question.id}`}><ArrowRight aria-hidden="true" size={18} /></Link>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </OnboardingShell>
  );
}
