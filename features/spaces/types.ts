export type SpaceInviteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "created";
      invitation: { id: string; code: string; formattedCode: string; expiresAt: string; link: string | null };
    }
  | { status: "revoked" };

export const initialSpaceInviteState: SpaceInviteState = { status: "idle" };

export type RedeemInviteState = { status: "idle" } | { status: "error"; message: string };

export const initialRedeemInviteState: RedeemInviteState = { status: "idle" };

export type SpaceInviteInspection =
  | { status: "available"; expiresAt: string }
  | { status: "unavailable" | "self_invite" | "active_space_conflict" };
