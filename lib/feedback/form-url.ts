const APPROVED_FEEDBACK_HOST = "www.cognitoforms.com";
const APPROVED_FEEDBACK_PATH = "/PreNikah/PreNikahAlphaFeedback2";

export type FeedbackFormUrlResult =
  | { status: "configured"; url: string }
  | { status: "invalid" | "missing"; url: null };

export function validateFeedbackFormUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL,
): FeedbackFormUrlResult {
  if (!value?.trim()) return { status: "missing", url: null };

  try {
    const url = new URL(value.trim());
    const isApproved =
      url.protocol === "https:" &&
      url.hostname === APPROVED_FEEDBACK_HOST &&
      url.pathname === APPROVED_FEEDBACK_PATH &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      url.search === "" &&
      url.hash === "";

    if (!isApproved) {
      return { status: "invalid", url: null };
    }

    return { status: "configured", url: url.toString() };
  } catch {
    return { status: "invalid", url: null };
  }
}

export function getFeedbackUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL,
): string | null {
  const result = validateFeedbackFormUrl(value);
  return result.status === "configured" ? result.url : null;
}
