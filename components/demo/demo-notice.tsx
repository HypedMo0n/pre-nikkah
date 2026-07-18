import { FlaskConical } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

export function DemoNotice({ locale }: { locale: Locale }) {
  return (
    <aside className="flex items-start gap-3 border-b border-discuss/20 bg-discuss-soft px-4 py-3 text-sm leading-6 text-body">
      <FlaskConical aria-hidden="true" className="mt-0.5 shrink-0 text-discuss" size={18} />
      <div>
        <p className="font-semibold text-ink">{translate(locale, "demo.warningTitle")}</p>
        <p>{translate(locale, "demo.warningBody")}</p>
      </div>
    </aside>
  );
}
