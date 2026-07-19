import { ExternalLink } from "lucide-react";

import { buttonClasses } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function FeedbackLink({ locale, url }: { locale: Locale; url: string }) {
  const d = getDictionary(locale);
  return (
    <div>
      <a
        aria-describedby="feedback-new-tab"
        className={buttonClasses({ className: "w-full" })}
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {d["feedback.action"]}
        <ExternalLink aria-hidden="true" size={18} />
      </a>
      <p className="mt-2 text-center text-xs leading-5 text-ink-soft" id="feedback-new-tab">
        {d["feedback.newTab"]}
      </p>
    </div>
  );
}

export function FeedbackHandoff({ locale, url }: { locale: Locale; url: string | null }) {
  const d = getDictionary(locale);

  if (!url) {
    return (
      <p className="rounded-productive border bg-section p-4 text-sm leading-6 text-body" role="status">
        {d["feedback.unavailable"]}
      </p>
    );
  }

  return <FeedbackLink locale={locale} url={url} />;
}
