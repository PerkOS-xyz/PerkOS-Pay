import { z } from "zod";

export const payEnvironmentSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("test"),
    origin: z.literal("https://test.pay.perkos.xyz"),
    stripeMode: z.literal("test"),
    cryptoMode: z.literal("testnet"),
  }),
  z.object({
    name: z.literal("production"),
    origin: z.literal("https://pay.perkos.xyz"),
    stripeMode: z.literal("live"),
    cryptoMode: z.literal("mainnet"),
  }),
]);

export type PayEnvironment = z.infer<typeof payEnvironmentSchema>;

export function environmentFor(
  name: string | undefined,
  testOrigin?: string,
): PayEnvironment {
  if (name === "production") {
    return {
      name: "production",
      origin: "https://pay.perkos.xyz",
      stripeMode: "live",
      cryptoMode: "mainnet",
    };
  }

  return {
    name: "test",
    origin: parseTestOrigin(testOrigin),
    stripeMode: "test",
    cryptoMode: "testnet",
  };
}

function parseTestOrigin(origin: string | undefined) {
  if (!origin) return "https://test.pay.perkos.xyz" as const;

  const url = new URL(origin);
  const isLocalhost = url.protocol === "http:" && url.hostname === "localhost";
  const isTestSite =
    url.protocol === "https:" && url.hostname === "test.pay.perkos.xyz";
  if (!isLocalhost && !isTestSite) {
    throw new Error("Test payment origin is not allowlisted");
  }
  return origin as "https://test.pay.perkos.xyz";
}

/**
 * Hostnames that serve production billing sessions, public and in-cluster.
 * A test deployment pointed at one of these would be serving live sessions
 * from a site whose Stripe and chain modes are test.
 */
const PRODUCTION_API_HOSTS = new Set(["api.perkos.xyz", "perkos-api"]);

/**
 * Whether this deployment may serve billing sessions.
 *
 * The binding that matters is which API mints the sessions, not the name of
 * the environment: `test.pay` talks to `dev.api`, so its sessions are dev
 * sessions and serving them is correct. What must never happen is a test
 * deployment reaching the production API, which would put live sessions behind
 * test-mode Stripe and testnet settlement.
 */
export function sessionsAllowedFor(input: {
  environment: PayEnvironment;
  apiUrl: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.environment.name === "production") return { ok: true };

  let host: string;
  try {
    host = new URL(input.apiUrl).hostname;
  } catch {
    return { ok: false, reason: "The API origin for this deployment is not a URL" };
  }
  if (PRODUCTION_API_HOSTS.has(host)) {
    return { ok: false, reason: "A test deployment cannot serve production billing sessions" };
  }
  return { ok: true };
}

export function assertEnvironmentBinding(input: {
  environment: PayEnvironment;
  requestOrigin: string;
  stripeLivemode?: boolean;
}): void {
  const { environment, requestOrigin, stripeLivemode } = input;
  if (requestOrigin !== environment.origin) {
    throw new Error("Payment origin does not match the configured environment");
  }
  if (stripeLivemode !== undefined && stripeLivemode !== (environment.stripeMode === "live")) {
    throw new Error("Stripe mode does not match the configured environment");
  }
}
