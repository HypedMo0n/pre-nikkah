import { formatRelativeTime } from "@/lib/format/relative-time";
import type { Locale } from "@/lib/i18n/config";

export type SharedNoteItem = {
  id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
};

// §7.9: "existing entries (author dot, name, relative time, body)".
export function SharedNoteList({ locale, notes }: { locale: Locale; notes: SharedNoteItem[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li className="rounded-card border border-hairline bg-white p-4" key={note.id}>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-green" />
            <span className="font-productive text-[13px] font-semibold text-ink">{note.authorLabel}</span>
            <span className="font-productive text-[12px] text-muted">{formatRelativeTime(note.createdAt, locale)}</span>
          </div>
          <p className="mt-1.5 font-productive text-[14px] leading-6 text-ink">{note.body}</p>
        </li>
      ))}
    </ul>
  );
}
