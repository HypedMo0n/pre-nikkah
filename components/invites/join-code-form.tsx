"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { isInviteCode, normalizeInviteCode } from "@/features/invites/invite-code";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function JoinCodeForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const d = getDictionary(locale);
  const normalized = normalizeInviteCode(value);
  const valid = isInviteCode(normalized);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (valid) router.push(`/${locale}/join/${normalized}`);
      }}
    >
      <Field
        autoComplete="off"
        label={d["join.codeLabel"]}
        onChange={(event) => setValue(event.target.value)}
        value={value}
      />
      {touched && !valid ? (
        <p className="font-productive text-[13px] text-danger">{d["join.unavailable"]}</p>
      ) : null}
      <Button className="w-full" type="submit">
        {d["common.continue"]}
      </Button>
    </form>
  );
}
