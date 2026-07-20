export type AnswerSaveState =
  | {
      status: "idle";
      message?: string;
      savedAt?: string;
      savedValue?: string;
    }
  | {
      status: "saved";
      message?: string;
      savedAt: string;
      savedValue: string;
    }
  | {
      status: "error";
      message?: string;
      savedValue?: string;
    }
  | {
      status: "journey_required";
      message: string;
      redirectTo: string;
      savedValue?: string;
    }
  | {
      status: "question_unavailable";
      message: string;
      redirectTo: string;
      savedValue?: string;
    };

export const initialAnswerSaveState = { status: "idle" } satisfies AnswerSaveState;
