import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import { setChecklistItemAction } from "@/features/checklist/actions";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { supabase } = await requireAuthenticatedUser(locale);
  const [definitionsResult, stateResult, coupleResult] = await Promise.all([
    supabase
      .from("checklist_definitions")
      .select("id,label,description,order_index")
      .eq("is_active", true)
      .order("order_index"),
    supabase
      .from("couple_checklist_items")
      .select("checklist_definition_id,done,completed_at"),
    supabase.rpc("current_couple_id"),
  ]);
  const d = getDictionary(locale);
  const definitions = definitionsResult.data ?? [];
  const state = new Map(
    (stateResult.data ?? []).map((item) => [item.checklist_definition_id, item]),
  );
  const doneCount = definitions.filter((item) => state.get(item.id)?.done).length;

  return (
    <OnboardingShell
      locale={locale}
      productive
      withTabBar
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {d["checklist.eyebrow"]}
      </p>
      <h1 className="font-expressive mt-2 text-3xl font-medium text-ink">{d["checklist.title"]}</h1>
      <p className="mt-3 text-sm leading-6 text-body">{d["checklist.body"]}</p>
      <p className="mt-4 text-sm font-semibold text-primary" aria-live="polite">
        {doneCount} {d["checklist.of"]} {definitions.length} {d["checklist.complete"]}
      </p>

      {!coupleResult.data ? (
        <div className="mt-7 rounded-productive border bg-card p-5">
          <p className="text-sm leading-6 text-body">{d["checklist.connectFirst"]}</p>
          <Link
            className={buttonClasses({ className: "mt-4 w-full" })}
            href={localizedPath(locale, "/invite")}
          >
            {d["dashboard.invite"]}
          </Link>
        </div>
      ) : definitions.length === 0 ? (
        <p className="mt-7 rounded-productive border bg-card p-5 text-sm text-body">
          {d["checklist.empty"]}
        </p>
      ) : (
        <div className="mt-7 space-y-3">
          {definitions.map((definition) => {
            const done = state.get(definition.id)?.done ?? false;
            return (
              <form
                action={setChecklistItemAction}
                className="flex items-center gap-3 rounded-productive border bg-card p-3"
                key={definition.id}
              >
                <input name="locale" type="hidden" value={locale} />
                <input
                  name="checklistDefinitionId"
                  type="hidden"
                  value={definition.id}
                />
                <input name="done" type="hidden" value={done ? "false" : "true"} />
                <SubmitButton
                  aria-label={`${done ? d["checklist.markOpen"] : d["checklist.markDone"]}: ${definition.label}`}
                  className="size-11 shrink-0 rounded-full p-0"
                  pendingLabel={d["common.loading"]}
                  variant={done ? "primary" : "secondary"}
                >
                  <Check aria-hidden="true" size={17} />
                </SubmitButton>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold text-ink ${done ? "line-through" : ""}`}>
                    {definition.label}
                  </p>
                  {definition.description ? (
                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                      {definition.description}
                    </p>
                  ) : null}
                </div>
              </form>
            );
          })}
        </div>
      )}

      <p className="mt-7 rounded-productive border bg-section p-4 text-xs leading-5 text-body">
        {d["checklist.disclaimer"]}
      </p>
    </OnboardingShell>
  );
}
