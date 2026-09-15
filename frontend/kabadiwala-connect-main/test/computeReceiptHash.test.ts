import { describe, it, expect } from "vitest";
import { canonicalizePayload, computeReceiptHash } from "../src/utils/crypto";
import { createHash } from "crypto";

describe("computeReceiptHash", () => {
  it("computes expected SHA-256 hash for a canonicalized payload", async () => {
    const payload = {
      receiptNumber: "EWB-2026-00001",
      timestamp: "2026-09-15T12:00:00.000Z",
      collectorName: "Ramesh Collector",
      recyclerLicense: "LIC-12345",
      materialKey: "copper-wire",
      weightKg: 12,
      ratePerKgInr: 755,
      finalPriceInr: 9060,
    } as const;

    const canonical = canonicalizePayload(payload as any);
    const expected = createHash("sha256").update(canonical).digest("hex");
    const computed = await computeReceiptHash(payload as any);

    expect(computed).toBe(expected);
  });
});
