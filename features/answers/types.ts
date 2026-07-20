export type AnswerSaveState = {
  status: "idle" | "saved" | "error";
  message?: string;
  savedAt?: string;
  savedValue?: string;
};

export const initialAnswerSaveState: AnswerSaveState = { status: "idle" };
