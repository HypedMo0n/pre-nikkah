import { randomUUID } from "node:crypto";

export type E2ETestUser = { email: string; password: string; displayName: string };
export type InviteFixture = { code: string; path: string };

export function makeTestUser(label: string): E2ETestUser {
  return {
    email: `e2e-${label}-${randomUUID()}@example.test`,
    password: `E2E-${randomUUID()}-password`,
    displayName: `E2E ${label}`,
  };
}

export function invitePath(code: string) {
  return `/en/join/${encodeURIComponent(code)}`;
}

export async function createWaitingJourney() {
  throw new Error("createWaitingJourney requires local Supabase fixture wiring; never run against production.");
}

export async function createActiveCouple() {
  throw new Error("createActiveCouple requires local Supabase fixture wiring; never run against production.");
}

export async function createValidInvite(): Promise<InviteFixture> {
  throw new Error("createValidInvite requires local Supabase fixture wiring; never run against production.");
}

export async function createExpiredInvite(): Promise<InviteFixture> {
  throw new Error("createExpiredInvite requires local Supabase fixture wiring; never run against production.");
}

export async function createRedeemedInvite(): Promise<InviteFixture> {
  throw new Error("createRedeemedInvite requires local Supabase fixture wiring; never run against production.");
}

export async function createClosedJourney() {
  throw new Error("createClosedJourney requires local Supabase fixture wiring; never run against production.");
}

export async function cleanupE2EFixtures() {
  throw new Error("cleanupE2EFixtures requires local Supabase fixture wiring; never run against production.");
}
