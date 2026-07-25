import Link from "next/link";

import type { V3Copy } from "@/features/v3/copy";
import type { TopicContent, TopicProgress } from "@/features/v3/types";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function JourneyPath({
  currentTopicId,
  d,
  discussedTopicIds,
  locale,
  progress,
  topics,
}: {
  currentTopicId?: string;
  d: V3Copy;
  discussedTopicIds: ReadonlySet<string>;
  locale: Locale;
  progress: TopicProgress[];
  topics: TopicContent[];
}) {
  const completed = topics.filter((topic) =>
    discussedTopicIds.has(topic.id),
  ).length;
  const current = topics.find((topic) => topic.id === currentTopicId);
  const currentProgress = progress.find(
    (item) => item.topicId === currentTopicId,
  );
  const stateLine =
    currentProgress &&
    currentProgress.partner > currentProgress.own &&
    currentProgress.own < currentProgress.total
      ? d.pathWaiting
      : current
        ? `${d.pathNext}: ${current.title}`
        : d.pathUpToDate;

  return (
    <section
      aria-labelledby="journey-path-title"
      className="mt-7 rounded-card border border-hairline bg-white p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-ink" id="journey-path-title">
          {d.pathTitle}
        </h2>
        <span className="text-sm font-semibold text-muted">
          {completed} / {topics.length}
        </span>
      </div>
      <div className="relative mt-5 grid grid-cols-6 place-items-center gap-x-1 gap-y-4">
        <span
          aria-hidden="true"
          className="absolute inset-x-4 top-[1.35rem] h-px bg-hairline"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-4 bottom-[1.35rem] h-px bg-hairline"
        />
        {topics.map((topic, index) => {
          const item = progress.find((row) => row.topicId === topic.id);
          const ownDone = Boolean(item && item.own >= item.total && item.total);
          const discussed = discussedTopicIds.has(topic.id);
          const currentNode = topic.id === currentTopicId;
          // A per-node partner mark would show, topic by topic, exactly which
          // subject the partner has not finished. Only the current shared topic
          // may carry that; a discussed topic is mutual knowledge already.
          const partnerDone =
            currentNode &&
            Boolean(item && item.partner >= item.total && item.total);
          return (
            <Link
              aria-label={`${index + 1}. ${topic.title}`}
              className={cn(
                "relative z-[1] flex size-11 items-center justify-center rounded-full bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green",
                currentNode && "ring-1 ring-green/30",
              )}
              href={localizedPath(locale, `/topics/${topic.slug}`)}
              key={topic.id}
              title={topic.title}
            >
              <PathMark
                discussed={discussed}
                ownDone={ownDone}
                partnerDone={partnerDone}
              />
              <span className="sr-only">{topic.title}</span>
            </Link>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xs font-medium text-muted">
        {stateLine}
      </p>
    </section>
  );
}

function PathMark({
  discussed,
  ownDone,
  partnerDone,
}: {
  discussed: boolean;
  ownDone: boolean;
  partnerDone: boolean;
}) {
  const both = ownDone && partnerDone;
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="28"
      viewBox="0 0 40 40"
      width="28"
    >
      <path
        d="M6 30C6 17 14 8 24 8"
        stroke={ownDone ? "var(--green)" : "var(--hairline)"}
        strokeLinecap="round"
        strokeWidth="3.5"
      />
      <path
        d="M34 10C34 23 26 32 16 32"
        stroke={
          both
            ? "var(--green)"
            : partnerDone
              ? "var(--amber)"
              : "var(--hairline)"
        }
        strokeLinecap="round"
        strokeWidth="3.5"
      />
      {discussed ? <circle cx="20" cy="20" fill="var(--green)" r="3" /> : null}
    </svg>
  );
}
