/**
 * Pure, offline validators for Indian business identifiers.
 * Used on the vendor form (instant hints) and by the server-side verification engine.
 */

export const PAN_RE = /^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PIN_RE = /^[1-9][0-9]{5}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;

export function normaliseId(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, "").toUpperCase() : "";
}

export function normalisePhone(v: unknown): string {
  if (typeof v !== "string") return "";
  let d = v.replace(/[^0-9+]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.startsWith("0091")) d = d.slice(4);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return d;
}

export function isValidIndianPhone(v: unknown): boolean {
  const d = normalisePhone(v);
  // Mobile numbers start 6-9; landlines with STD code are also 10 digits.
  return /^[0-9]{10}$/.test(d) && !/^0/.test(d);
}

/** PAN 4th character → holder type. */
export const PAN_HOLDER_TYPES: Record<string, string> = {
  A: "Association of Persons",
  B: "Body of Individuals",
  C: "Company",
  F: "Firm / LLP",
  G: "Government",
  H: "Hindu Undivided Family",
  J: "Artificial Juridical Person",
  L: "Local Authority",
  P: "Individual / Proprietor",
  T: "Trust",
};

/** Which PAN holder types are consistent with each business type option. */
export const BUSINESS_TYPE_PAN: Record<string, string[]> = {
  Proprietorship: ["P"],
  Partnership: ["F"],
  LLP: ["F"],
  "Private Limited": ["C"],
  "Public Limited": ["C"],
  HUF: ["H"],
  "Society / Trust": ["T", "A", "J"],
};

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Dadra and Nagar Haveli and Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function gstinCheckDigit(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GST_CHARS.indexOf(first14[i] ?? "");
    if (v < 0) return "?";
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36] ?? "?";
}

export function validatePan(raw: unknown): string | null {
  const v = normaliseId(raw);
  if (!v) return null;
  if (v.length !== 10) return "PAN must be exactly 10 characters (e.g. ABCDE1234F).";
  if (!PAN_RE.test(v))
    return "PAN format is invalid — it should be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).";
  return null;
}

export function validateGstin(raw: unknown): string | null {
  const v = normaliseId(raw);
  if (!v) return null;
  if (v.length !== 15) return "GSTIN must be exactly 15 characters.";
  if (!GSTIN_RE.test(v)) return "GSTIN format is invalid (expected e.g. 27ABCDE1234F1Z5).";
  if (!GST_STATE_CODES[v.slice(0, 2)])
    return `GSTIN starts with an unknown state code "${v.slice(0, 2)}".`;
  if (gstinCheckDigit(v.slice(0, 14)) !== v[14])
    return "GSTIN check digit does not match — please re-check for a typo.";
  return null;
}

export function validateIfsc(raw: unknown): string | null {
  const v = normaliseId(raw);
  if (!v) return null;
  if (!IFSC_RE.test(v))
    return "IFSC must be 11 characters: 4 letters, a zero, then 6 letters/digits (e.g. HDFC0001234).";
  return null;
}

export function validatePin(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  if (!PIN_RE.test(v)) return "PIN code must be 6 digits and cannot start with 0.";
  return null;
}

export function validateEmail(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

export function validatePhone(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  if (!isValidIndianPhone(v))
    return "Enter a valid 10-digit Indian phone number (optionally with +91).";
  return null;
}

export function validateAccountNumber(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.replace(/\s+/g, "") : "";
  if (!v) return null;
  if (!ACCOUNT_RE.test(v)) return "Account number should be 9–18 digits.";
  return null;
}

/** Instant, field-level hint used on the vendor form. */
export function quickFieldError(key: string, inputType: string, value: unknown): string | null {
  if (key === "pan") return validatePan(value);
  if (key === "gstin") return validateGstin(value);
  if (key === "ifsc") return validateIfsc(value);
  if (key === "pin_code") return validatePin(value);
  if (key === "account_number") return validateAccountNumber(value);
  if (inputType === "email") return validateEmail(value);
  if (inputType === "phone") return validatePhone(value);
  return null;
}

// ---------- name matching ----------

const NAME_NOISE = new Set([
  "m",
  "s",
  "ms",
  "mr",
  "mrs",
  "the",
  "and",
  "&",
  "pvt",
  "private",
  "ltd",
  "limited",
  "llp",
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "india",
  "enterprises",
  "enterprise",
  "firm",
  "opc",
]);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NAME_NOISE.has(t));
}

/** 0..1 similarity between two business/person names, tolerant of suffixes like "Pvt Ltd". */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  const A = new Set(ta);
  const B = new Set(tb);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const jaccard = inter / new Set([...A, ...B]).size;
  const ja = ta.join("");
  const jb = tb.join("");
  const contains = ja.includes(jb) || jb.includes(ja) ? 0.9 : 0;
  return Math.max(jaccard, contains);
}
