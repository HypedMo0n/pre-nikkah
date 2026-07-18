export type InviteActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "created";
      invitation: {
        id: string;
        code: string;
        formattedCode: string;
        expiresAt: string;
        link: string;
      };
    }
  | { status: "revoked" };

export const initialInviteActionState: InviteActionState = { status: "idle" };

export type InviteInspection =
  | { status: "available"; expiresAt: string }
  | { status: "unavailable" | "self_invite" | "active_couple_conflict" };
