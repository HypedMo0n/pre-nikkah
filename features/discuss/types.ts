export type DiscussActionState = { status: "idle" } | { status: "error"; message: string };

export const initialDiscussActionState: DiscussActionState = { status: "idle" };
