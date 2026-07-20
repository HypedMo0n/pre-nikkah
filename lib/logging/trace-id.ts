import { randomUUID } from "crypto";

/**
 * Generate a unique trace ID for correlating logs across requests.
 * Format: UUID for uniqueness and easy searching.
 */
export function generateTraceId(): string {
  return randomUUID();
}
