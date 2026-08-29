import { environmentFor } from "./environment";

export function getRuntimeConfig() {
  const environment = environmentFor(process.env.PERKOS_PAY_ENV);
  const paymentsEnabled = process.env.PERKOS_PAYMENTS_ENABLED === "true";

  return {
    environment,
    paymentsEnabled,
  } as const;
}

