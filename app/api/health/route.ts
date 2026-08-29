import { NextResponse } from "next/server";

import { getRuntimeConfig } from "@/lib/runtime";

export function GET() {
  const config = getRuntimeConfig();
  return NextResponse.json({
    ok: true,
    service: "perkos-pay",
    environment: config.environment.name,
    paymentsEnabled: config.paymentsEnabled,
  });
}

