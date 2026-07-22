export type InviteActionState =
  | { status: "idle" }
  | { status: "not_eligible"; message: string }
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
  | { status: "unavailable" | "self_invite" | "active_couple_conflict" | "expired" | "already_used" | "waiting_journey_conflict" };
