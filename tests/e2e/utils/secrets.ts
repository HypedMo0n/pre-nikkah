export type E2ECredentials = {
  baseURL: string;
  email: string;
  password: string;
};

export function requiredEnv(name: "E2E_BASE_URL" | "E2E_TEST_EMAIL" | "E2E_TEST_PASSWORD") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for authenticated E2E smoke tests. Configure it in the environment; do not write it to source files.`);
  }
  return value;
}

export function getE2ECredentials(): E2ECredentials {
  return {
    baseURL: requiredEnv("E2E_BASE_URL"),
    email: requiredEnv("E2E_TEST_EMAIL"),
    password: requiredEnv("E2E_TEST_PASSWORD"),
  };
}

export function redactSensitive(input: string) {
  return input
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/\b(?:eyJ|sb-|pk_|sk_)[A-Za-z0-9._-]+\b/g, "[redacted-token]")
    .replace(/\b[a-f0-9]{20,}\b/gi, "[redacted-token]")
    .replace(/(?:password|access_token|refresh_token|code)=([^&\s]+)/gi, "$1=[redacted]");
}
