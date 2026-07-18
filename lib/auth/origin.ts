import "server-only";

function safeConfiguredOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getAuthRedirectOrigin() {
  return (
    safeConfiguredOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    safeConfiguredOrigin(process.env.VERCEL_URL) ??
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : null)
  );
}
