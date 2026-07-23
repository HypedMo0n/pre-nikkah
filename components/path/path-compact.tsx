"use client";

import Link from "next/link";
import { useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { formatDate } from "@/lib/format/date";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

import { PathNode } from "./path-node";
import { deriveTopicState, type TopicProgress, type TopicProgressState } from "./topic-progress";

// §7.10. The Path is a visualization and a gateway to the record, not a
// per-topic navigation surface — Home's separate "YOUR CONVERSATIONS" list
// (§7.5) is where individual topics are opened, so nodes here never nest a
// second interactive element inside the tap-to-expand target.
export function PathCompact({
  locale,
  topics,
  partnerName,
}: {
  locale: Locale;
  topics: TopicProgress[];
  partnerName: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const d = getDictionary(locale);
  const states = topics.map(deriveTopicState);
  const completedCount = states.filter((state) => state.leftDone).length;
  const partnerLabel = partnerName ?? d["topics.partnerFallback"];
  const allComplete = states.length > 0 && states.every((state) => state.leftDone && state.rightDone);

  const currentTopicId = states.find((state) => !(state.leftDone && state.rightDone))?.topicId ?? null;
  const waitingOnMe = states.find((state) => state.rightDone && !state.leftDone);
  const nextForMe = states.find((state) => !state.leftDone);

  const subline = waitingOnMe
    ? d["path.waitingOnYou"].replace("{partner}", partnerLabel)
    : nextForMe
      ? d["path.next"].replace("{topic}", nextForMe.title)
      : d["path.upToDate"];

  const rowOne = states.slice(0, 6);
  const rowTwo = states.slice(6, 12).slice().reverse();

  function renderRow(row: TopicProgressState[]) {
    return (
      <div className="flex items-center">
        {row.map((state, index) => {
          const isLastNode = topics[topics.length - 1]?.topicId === state.topicId;
          return (
            <div className="flex flex-1 items-center" key={state.topicId}>
              <PathNode
                emphasized={currentTopicId === state.topicId}
                left={state.left}
                right={state.right}
                showDot={state.isDiscussed}
                size={isLastNode ? 28 : 24}
              />
              {index < row.length - 1 ? <span aria-hidden="true" className="h-px flex-1 bg-hairline" /> : null}
            </div>
          );
        })}
      </div>
    );
  }

  const body = (
    <>
      <p className="font-productive text-[14.5px] font-semibold text-ink">
        {d["path.header"].replace("{count}", String(completedCount)).replace("{total}", String(topics.length))}
      </p>
      <div className="mt-3">
        {renderRow(rowOne)}
        <div className="flex justify-end pr-[11px]">
          <span aria-hidden="true" className="h-4 w-px bg-hairline" />
        </div>
        {renderRow(rowTwo)}
      </div>
      <p className="mt-3 font-productive text-[13px] text-muted">{subline}</p>
    </>
  );

  if (allComplete) {
    return (
      <Link className="block w-full text-left" href={localizedPath(locale, "/record")}>
        {body}
      </Link>
    );
  }

  return (
    <div>
      <button className="block w-full text-left" onClick={() => setExpanded(true)} type="button">
        {body}
      </button>
      <Sheet onClose={() => setExpanded(false)} open={expanded} title={d["path.expandedTitle"]}>
        <PathExpanded currentTopicId={currentTopicId} locale={locale} states={states} />
      </Sheet>
    </div>
  );
}

function PathExpanded({
  locale,
  states,
  currentTopicId,
}: {
  locale: Locale;
  states: TopicProgressState[];
  currentTopicId: string | null;
}) {
  return (
    <ul>
      {states.map((state, index) => {
        const isCurrent = state.topicId === currentTopicId;
        return (
          <li className="flex gap-3" key={state.topicId}>
            <div className="flex flex-col items-center">
              <PathNode left={state.left} right={state.right} showDot={state.isDiscussed} />
              {index < states.length - 1 ? (
                <span aria-hidden="true" className="my-1 w-px flex-1 bg-hairline" style={{ minHeight: 20 }} />
              ) : null}
            </div>
            <div className="flex-1 pb-5">
              <p className={cn("font-productive text-[14px]", isCurrent ? "font-semibold text-ink" : "text-muted")}>{state.title}</p>
              {state.isDiscussed && state.discussedAt ? (
                <p className="mt-0.5 font-productive text-[12px] text-muted">{formatDate(state.discussedAt, locale)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
