export type SettingsActionState = { status: "idle" } | { status: "error"; message: string };

export const initialSettingsActionState: SettingsActionState = { status: "idle" };
