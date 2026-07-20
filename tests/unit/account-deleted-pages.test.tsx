import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));

const { default: AccountDeletedPage } = await import("@/app/[locale]/(public)/account-deleted/page");
const { default: AccountDeletedFallbackPage } = await import("@/app/account-deleted/page");

describe("account deleted public pages", () => {
  it("renders the English confirmation while signed out", async () => {
    const html = renderToStaticMarkup(await AccountDeletedPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(html).toContain("Your account has been successfully deleted");
    expect(html).toContain("Your private profile and journey data have been removed.");
  });

  it("renders the French confirmation while signed out", async () => {
    const html = renderToStaticMarkup(await AccountDeletedPage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).toContain("Votre compte a été supprimé avec succès");
    expect(html).toContain("Votre profil privé et les données de votre parcours ont été supprimés.");
  });

  it("has a nonlocalized fallback that safely redirects instead of 404ing", () => {
    expect(() => AccountDeletedFallbackPage()).toThrow("NEXT_REDIRECT:/en/account-deleted");
  });
});
