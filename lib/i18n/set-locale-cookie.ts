import { localeCookieName, type Locale } from "./config";

const oneYearInSeconds = 60 * 60 * 24 * 365;

// Split out of the locale picker component: the eslint-plugin-react-hooks
// immutability rule flags any mutation of an externally defined value
// (document included) written directly inside a component or hook body,
// even from a plain event handler — moving it into an ordinary helper
// function sidesteps that without changing when it actually runs.
export function setLocaleCookie(locale: Locale) {
  document.cookie = `${localeCookieName}=${locale}; path=/; max-age=${oneYearInSeconds}; samesite=lax`;
}
