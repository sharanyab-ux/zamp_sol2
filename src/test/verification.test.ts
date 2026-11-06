import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { gstinCheckDigit, nameSimilarity, validateGstin, validateIfsc, validatePan, validatePhone } from "@/lib/validators";
import { offlineChecks } from "@/lib/verification-rules";
import type { FormSnapshot } from "@/lib/form-schema";

const withCheck = (first14: string) => first14 + gstinCheckDigit(first14);

describe("validators", () => {
  it("accepts a GSTIN with a correct check digit and rejects a typo", () => {
    const good = withCheck("27ABCDE1234F1Z");
    expect(validateGstin(good)).toBeNull();
    const bad = good.slice(0, 14) + (good[14] === "A" ? "B" : "A");
    expect(validateGstin(bad)).toMatch(/check digit/);
    expect(validateGstin("27ABCDE1234F1Y5")).toMatch(/format/);
    expect(validateGstin("28ABCDE1234F1Z5")).not.toBeNull();
  });

  it("validates PAN, IFSC and phone", () => {
    expect(validatePan("ABCPD1234E")).toBeNull();
    expect(validatePan("ABCXD1234E")).not.toBeNull();
    expect(validateIfsc("HDFC0001234")).toBeNull();
    expect(validateIfsc("HDFC1001234")).not.toBeNull();
    expect(validatePhone("+91 98765 43210")).toBeNull();
    expect(validatePhone("12345")).not.toBeNull();
  });

  it("matches business names despite suffixes", () => {
    expect(nameSimilarity("Sharma Traders Pvt Ltd", "M/S SHARMA TRADERS PRIVATE LIMITED")).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity("HDFC", "HDFC Bank")).toBeGreaterThanOrEqual(0.34);
    expect(nameSimilarity("Kaveri Packaging", "Sharma Traders")).toBeLessThan(0.34);
  });
});

const snapshot: FormSnapshot = {
  name: "Test",
  version: 1,
  sections: [
    {
      title: "All",
      fields: [
        { key: "legal_business_name", label: "Legal Business Name", input_type: "text", required: true },
        { key: "business_type", label: "Business Type", input_type: "dropdown", required: true },
        { key: "pan", label: "PAN", input_type: "text", required: true },
        { key: "gstin", label: "GSTIN", input_type: "text", required: false },
        { key: "state", label: "State", input_type: "dropdown", required: false },
        { key: "tax_preference", label: "Tax Preference", input_type: "dropdown", required: false },
        { key: "account_number", label: "Account Number", input_type: "text", required: true },
        { key: "confirm_account_number", label: "Confirm Account Number", input_type: "text", required: true },
        { key: "cancelled_cheque", label: "Cancelled Cheque", input_type: "file", required: true },
      ],
    },
  ],
};

describe("offline verification", () => {
  it("passes a consistent submission", () => {
    const checks = offlineChecks(snapshot, {
      legal_business_name: "Sharma Traders Pvt Ltd",
      business_type: "Private Limited",
      pan: "ABCCD1234E",
      gstin: withCheck("27ABCCD1234E1Z"),
      state: "Maharashtra",
      tax_preference: "Taxable",
      account_number: "123456789012",
      confirm_account_number: "123456789012",
      cancelled_cheque: [{ path: "o/i/cancelled_cheque/x.pdf", name: "x.pdf", mime: "application/pdf", size: 1000 }],
    });
    expect(checks.filter((c) => c.result === "fail")).toEqual([]);
  });

  it("collects every problem in one pass", () => {
    const checks = offlineChecks(snapshot, {
      legal_business_name: "Sharma Traders",
      business_type: "Private Limited",
      pan: "ABCPD1234E", // individual PAN for a company
      gstin: withCheck("27ZZZZZ9999Z1Z"), // different PAN inside
      tax_preference: "Taxable",
      account_number: "123456789012",
      confirm_account_number: "123456789013",
    });
    const fails = checks.filter((c) => c.result === "fail").map((c) => c.check_name);
    expect(fails).toEqual(
      expect.arrayContaining([
        "Cancelled Cheque provided",
        "Account number confirmation matches",
        "GSTIN contains the PAN",
        "PAN type matches business type",
      ]),
    );
  });

  it("requires a GSTIN when the vendor is taxable", () => {
    const checks = offlineChecks(snapshot, { tax_preference: "Taxable" });
    expect(checks.some((c) => c.field_key === "gstin" && c.result === "fail")).toBe(true);
  });
});

describe("routes", () => {
  it("registers the new pages", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of ["/forms", "/forms/abc", "/vendors", "/vendors/abc", "/approved", `/v/${"a".repeat(48)}`]) {
      expect(router.matchRoutes(path).at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });
});
