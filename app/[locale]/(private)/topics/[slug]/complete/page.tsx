import { Check } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { buttonClasses } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function TopicCompletePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireAuthenticatedUser(locale);
  const { data: topic } = await supabase.from("topics").select("id").eq("slug", slug).single();
  if (!topic) notFound();
  const [{ count: questionCount }, { count: answerCount }] = await Promise.all([
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("topic_id", topic.id).eq("is_active", true),
    supabase.from("answers").select("id,questions!inner(topic_id)", { count: "exact", head: true }).eq("user_id", user.id).eq("questions.topic_id", topic.id),
  ]);
  if (!questionCount || answerCount !== questionCount) redirect(localizedPath(locale, `/topics/${slug}`));
  const d = getDictionary(locale);
  return <OnboardingShell locale={locale}><div className="text-center"><span className="mx-auto flex size-16 items-center justify-center rounded-full bg-aligned-soft text-aligned"><Check aria-hidden="true" size={28} /></span><h1 className="font-expressive mt-6 text-3xl font-medium text-ink">{d["complete.title"]}</h1><p className="mt-3 leading-7 text-body">{d["complete.body"]}</p><Link className={buttonClasses({ className: "mt-8 w-full" })} href={localizedPath(locale, "/dashboard")}>{d["complete.dashboard"]}</Link></div></OnboardingShell>;
}
