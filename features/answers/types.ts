import type { ImportanceLevel } from "@/components/ui/importance-row";

export type QuestionOption = {
  key: string;
  label: string;
  description: string;
  cluster: string;
};

// §5's "core loop, restated": the whole point of the reveal step is that it
// only ever carries state/priority/who — never an option key, never either
// side's private note.
export type ComparisonReveal =
  | { kind: "waiting" }
  | {
      kind: "pattern";
      state: "aligned" | "discuss";
      priority: ImportanceLevel | null;
      drivenBy: "me" | "partner" | null;
    };

export type SaveAnswerState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; reveal: ComparisonReveal };

export const initialSaveAnswerState: SaveAnswerState = { status: "idle" };
