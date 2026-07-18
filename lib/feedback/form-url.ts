const GOOGLE_FORMS_HOSTS = new Set(["docs.google.com", "forms.gle"]);

export type FeedbackFormUrlResult =
  | { status: "configured"; url: string }
  | { status: "invalid" | "missing"; url: null };

export function validateFeedbackFormUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL,
): FeedbackFormUrlResult {
  if (!value?.trim()) return { status: "missing", url: null };

  try {
    const url = new URL(value.trim());
    const hostAllowed = GOOGLE_FORMS_HOSTS.has(url.hostname.toLowerCase());
    const pathAllowed =
      url.hostname.toLowerCase() === "forms.gle" ||
      url.pathname.startsWith("/forms/");
    if (url.protocol !== "https:" || !hostAllowed || !pathAllowed) {
      return { status: "invalid", url: null };
    }

    // The application never appends or forwards context in the feedback URL.
    // Removing configured query and fragment values also prevents accidental
    // prefilled personal data from entering the external handoff.
    url.search = "";
    url.hash = "";
    return { status: "configured", url: url.toString() };
  } catch {
    return { status: "invalid", url: null };
  }
}
