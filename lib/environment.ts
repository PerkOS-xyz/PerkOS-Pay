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

export function environmentFor(name: string | undefined): PayEnvironment {
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
    origin: "https://test.pay.perkos.xyz",
    stripeMode: "test",
    cryptoMode: "testnet",
  };
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

