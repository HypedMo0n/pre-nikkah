export type DeleteAccountState =
  | { status: "idle"; message?: string }
  | { status: "error"; message: string }
  | { status: "deleted"; redirectTo: string };

export const initialDeleteAccountState: DeleteAccountState = {
  status: "idle",
};
