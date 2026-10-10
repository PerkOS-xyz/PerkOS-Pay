import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");

describe("payment surface dependency security", () => {
  it("keeps Next and its lint configuration on the patched release", () => {
    expect(manifest.dependencies.next).toBe("16.4.0");
    expect(manifest.devDependencies["eslint-config-next"]).toBe("16.4.0");
    expect(lock).toMatch(/^  next@16\.4\.0:/m);
    expect(lock).not.toMatch(/^  next@16\.2\.6:/m);
  });

  it("pins the patched source map dependency in the pnpm configuration", () => {
    expect(workspace).toMatch(/source-map-js: 1\.2\.2/);
    expect(lock).toMatch(/^  source-map-js@1\.2\.2:/m);
    expect(lock).not.toMatch(/^  source-map-js@1\.2\.1:/m);
  });
});
