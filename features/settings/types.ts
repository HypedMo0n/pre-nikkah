export type SettingsActionState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

export const initialSettingsActionState: SettingsActionState = { status: "idle" };
