import Link from "next/link";
import { notFound } from "next/navigation";

import { HowItWorksDemo } from "@/components/onboarding/how-it-works-demo";
import { buttonClasses } from "@/components/ui/button";
import { hasPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { isLocale, localizedPath, parseLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// §7.2. Reachable signed out, so this reads topics through the anon-only
// read grant added for exactly this screen (migration 1000) rather than
// requireAuthenticatedUser. hasPublicEnv() guards the fetch the same way
// requireAuthenticatedUser does internally — createClient() throws when
// Supabase isn't configured, and unlike every other screen this one has
// no auth gate upstream to already have caught that.
export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = parseLocale(rawLocale);
  const d = getDictionary(locale);

  let topics: { title: string; order_index: number }[] | null = null;
  if (hasPublicEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.from("topics").select("title, order_index").eq("is_active", true).order("order_index");
    topics = data;
  }

  return (
    <main className="mx-auto w-full max-w-md px-7 py-10">
      <p className="font-productive text-[12px] font-semibold uppercase tracking-[0.12em] text-green">
        {d["howItWorks.eyebrow"]}
      </p>
      <h1 className="font-expressive mt-2 text-[32px] font-light leading-[1.15] text-ink">{d["howItWorks.headline"]}</h1>

      <HowItWorksDemo locale={locale} />

      {topics && topics.length > 0 ? (
        <p className="mt-8 flex flex-wrap gap-x-2 gap-y-1 font-productive text-[11px] text-muted">
          {topics.map((topic, index) => (
            <span key={topic.title}>
              {topic.title}
              {index < topics.length - 1 ? " ·" : ""}
            </span>
          ))}
        </p>
      ) : null}

      <Link className={buttonClasses({ className: "mt-8 w-full" })} href={localizedPath(locale, "/create-space")}>
        {d["common.continue"]}
      </Link>
    </main>
  );
}
