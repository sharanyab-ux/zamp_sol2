/**
 * Checks against outside registries.
 *
 * GSTIN: the GST portal (gst.gov.in) has no open public API — direct access needs a licensed GST Suvidha
 * Provider. We call a provider that relays GSTN taxpayer records. Supported today: Appyflow
 * (https://appyflow.in/verify-gst/). Set GSTIN_API_KEY (and optionally GSTIN_PROVIDER=appyflow).
 * Without a key, the check is recorded as "not verified" — never as passed.
 *
 * IFSC: Razorpay's free public IFSC directory (https://ifsc.razorpay.com), sourced from RBI's branch list.
 */
import { GST_STATE_CODES, nameSimilarity, normaliseId } from "./validators";
import type { Check } from "./verification-rules";
import type { FormValues } from "./form-schema";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export interface GstRecord {
  gstin: string;
  legalName: string;
  tradeName: string;
  status: string;
  registeredOn?: string | undefined;
  taxpayerType?: string | undefined;
  constitution?: string | undefined;
  pin?: string | undefined;
  state?: string | undefined;
  address?: string | undefined;
}

type Lookup<T> =
  | { kind: "found"; record: T }
  | { kind: "not_found"; message: string }
  | { kind: "unavailable"; message: string };

export function gstProviderConfigured() {
  return Boolean(process.env["GSTIN_API_KEY"]);
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

export async function lookupGstin(gstin: string): Promise<Lookup<GstRecord>> {
  const key = process.env["GSTIN_API_KEY"];
  if (!key)
    return {
      kind: "unavailable",
      message:
        "No GST lookup provider is configured, so the GSTIN was not checked against government records.",
    };
  const provider = (process.env["GSTIN_PROVIDER"] || "appyflow").toLowerCase();
  if (provider !== "appyflow")
    return { kind: "unavailable", message: `GST provider "${provider}" is not supported.` };
  try {
    const url = `https://appyflow.in/api/verifyGST?gstNo=${encodeURIComponent(gstin)}&key_secret=${encodeURIComponent(key)}`;
    const { status, body } = await fetchJson(url);
    const b = body as {
      error?: boolean;
      message?: string;
      taxpayerInfo?: Record<string, unknown>;
    } | null;
    if (!b) return { kind: "unavailable", message: `GST lookup failed (HTTP ${status}).` };
    if (b.error || !b.taxpayerInfo) {
      const msg = String(b.message ?? "");
      if (/invalid|not\s*found|no\s*record|does not exist/i.test(msg))
        return { kind: "not_found", message: msg };
      return {
        kind: "unavailable",
        message: msg ? `GST lookup error: ${msg}` : "GST lookup returned no data.",
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t: any = b.taxpayerInfo;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addr: any = t.pradr?.addr ?? {};
    return {
      kind: "found",
      record: {
        gstin: String(t.gstin ?? gstin),
        legalName: String(t.lgnm ?? ""),
        tradeName: String(t.tradeNam ?? ""),
        status: String(t.sts ?? ""),
        registeredOn: t.rgdt,
        taxpayerType: t.dty,
        constitution: t.ctb,
        pin: addr.pncd,
        state: addr.stcd,
        address: [
          addr.bno,
          addr.flno,
          addr.bnm,
          addr.st,
          addr.loc,
          addr.city,
          addr.dst,
          addr.stcd,
          addr.pncd,
        ]
          .filter(Boolean)
          .join(", "),
      },
    };
  } catch (e) {
    return {
      kind: "unavailable",
      message: `GST lookup could not be reached (${e instanceof Error ? e.message : "network error"}).`,
    };
  }
}

export interface IfscRecord {
  bank: string;
  branch: string;
  city: string;
  state: string;
}

export async function lookupIfsc(ifsc: string): Promise<Lookup<IfscRecord>> {
  try {
    const { status, body } = await fetchJson(
      `https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`,
    );
    if (status === 404) return { kind: "not_found", message: "IFSC not found" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = body as any;
    if (status !== 200 || !b?.BANK)
      return { kind: "unavailable", message: `IFSC lookup failed (HTTP ${status}).` };
    return {
      kind: "found",
      record: {
        bank: String(b.BANK),
        branch: String(b.BRANCH ?? ""),
        city: String(b.CITY ?? ""),
        state: String(b.STATE ?? ""),
      },
    };
  } catch (e) {
    return {
      kind: "unavailable",
      message: `IFSC directory could not be reached (${e instanceof Error ? e.message : "network error"}).`,
    };
  }
}

export async function externalChecks(
  rawValues: FormValues,
  fieldKeys: Set<string>,
): Promise<Check[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const values: any = rawValues;
  const checks: Check[] = [];
  const gstin = normaliseId(values.gstin);
  const ifsc = normaliseId(values.ifsc);
  const tasks: Promise<void>[] = [];

  if (fieldKeys.has("gstin") && gstin.length === 15) {
    tasks.push(
      lookupGstin(gstin).then((r) => {
        const src = "GSTN taxpayer records";
        if (r.kind === "unavailable") {
          checks.push({
            category: "Government records",
            check_name: "GSTIN on GST records",
            result: "not_verified",
            explanation: r.message,
            field_key: "gstin",
            source: src,
          });
          return;
        }
        if (r.kind === "not_found") {
          checks.push({
            category: "Government records",
            check_name: "GSTIN on GST records",
            result: "fail",
            explanation: `GSTIN ${gstin} was not found on GST records. Please check the number.`,
            field_key: "gstin",
            source: src,
          });
          return;
        }
        const g = r.record;
        const active = /^active$/i.test(g.status);
        checks.push({
          category: "Government records",
          check_name: "GSTIN is active on GST records",
          result: active ? "pass" : "fail",
          explanation: active
            ? `Active since ${g.registeredOn ?? "—"} · ${g.legalName}${g.tradeName ? ` (trade name ${g.tradeName})` : ""} · ${g.taxpayerType ?? ""} · ${g.address ?? ""}`
            : `GST records show this GSTIN's status as "${g.status || "unknown"}". Only active registrations can be accepted.`,
          field_key: "gstin",
          source: src,
        });
        const formName =
          str(values.legal_business_name) || str(values.trade_name) || str(values.display_name);
        if (formName) {
          const sim = Math.max(
            nameSimilarity(formName, g.legalName),
            nameSimilarity(formName, g.tradeName),
          );
          checks.push({
            category: "Government records",
            check_name: "Business name matches GST records",
            result: sim >= 0.6 ? "pass" : "fail",
            explanation:
              sim >= 0.6
                ? `"${formName}" matches the name on GST records ("${g.legalName}").`
                : `The legal name on GST records is "${g.legalName}"${g.tradeName ? ` (trade name "${g.tradeName}")` : ""}, but the form says "${formName}". Enter the name exactly as registered for GST.`,
            field_key: fieldKeys.has("legal_business_name")
              ? "legal_business_name"
              : "display_name",
            source: src,
          });
        }
        const pin = str(values.pin_code);
        if (pin && g.pin && pin !== g.pin) {
          checks.push({
            category: "Government records",
            check_name: "PIN code matches GST address",
            result: "warning",
            explanation: `GST principal place of business PIN is ${g.pin}; the form says ${pin}.`,
            field_key: "pin_code",
            source: src,
          });
        }
        if (
          g.state &&
          str(values.state) &&
          g.state.toLowerCase() !== str(values.state).toLowerCase() &&
          GST_STATE_CODES[gstin.slice(0, 2)]?.toLowerCase() !== str(values.state).toLowerCase()
        ) {
          checks.push({
            category: "Government records",
            check_name: "State matches GST address",
            result: "warning",
            explanation: `GST records list the state as ${g.state}; the form says ${str(values.state)}.`,
            field_key: "state",
            source: src,
          });
        }
      }),
    );
  }

  if (fieldKeys.has("ifsc") && ifsc.length === 11) {
    tasks.push(
      lookupIfsc(ifsc).then((r) => {
        const src = "RBI IFSC directory (via Razorpay)";
        if (r.kind === "unavailable") {
          checks.push({
            category: "Bank records",
            check_name: "IFSC exists",
            result: "not_verified",
            explanation: r.message,
            field_key: "ifsc",
            source: src,
          });
          return;
        }
        if (r.kind === "not_found") {
          checks.push({
            category: "Bank records",
            check_name: "IFSC exists",
            result: "fail",
            explanation: `IFSC ${ifsc} does not match any bank branch. Check it against your cheque book or bank statement.`,
            field_key: "ifsc",
            source: src,
          });
          return;
        }
        const b = r.record;
        checks.push({
          category: "Bank records",
          check_name: "IFSC exists",
          result: "pass",
          explanation: `${b.bank}, ${b.branch} branch, ${b.city}, ${b.state}.`,
          field_key: "ifsc",
          source: src,
        });
        const bankName = str(values.bank_name);
        if (bankName) {
          const sim = nameSimilarity(bankName, b.bank);
          checks.push({
            category: "Bank records",
            check_name: "Bank name matches IFSC",
            result: sim >= 0.34 ? "pass" : "fail",
            explanation:
              sim >= 0.34
                ? `"${bankName}" matches ${b.bank}.`
                : `IFSC ${ifsc} belongs to ${b.bank}, but the bank name entered is "${bankName}".`,
            field_key: "bank_name",
            source: src,
          });
        }
      }),
    );
  }

  await Promise.all(tasks);
  return checks;
}
