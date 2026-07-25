export type ActionState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

export const initialActionState: ActionState = { status: "idle" };

export type InviteState =
  | { status: "idle"; message?: string }
  | { status: "error"; message: string }
  | {
      status: "created";
      invitation: {
        code: string;
        formattedCode: string;
        expiresAt: string;
        link: string;
      };
    };

export const initialInviteState: InviteState = { status: "idle" };

export type AnswerActionState = ActionState & {
  comparisonState?: "pending" | "aligned" | "discuss";
  partnerReady?: boolean;
  priority?: "low" | "medium" | "high";
  savedOption?: string;
  savedAt?: string;
};
