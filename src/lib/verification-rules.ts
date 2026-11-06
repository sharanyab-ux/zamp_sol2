import { ACCEPTED_UPLOAD_TYPES } from "./field-library";
import {
  allFields,
  isEmptyValue,
  isFileList,
  type FormSnapshot,
  type FormValues,
} from "./form-schema";
import {
  BUSINESS_TYPE_PAN,
  GST_STATE_CODES,
  PAN_HOLDER_TYPES,
  nameSimilarity,
  normaliseId,
  validateAccountNumber,
  validateEmail,
  validateGstin,
  validateIfsc,
  validatePan,
  validatePhone,
  validatePin,
} from "./validators";

export type CheckResult = "pass" | "fail" | "warning" | "not_verified" | "manual_review";

export interface Check {
  category:
    | "Completeness"
    | "Format"
    | "Consistency"
    | "Government records"
    | "Bank records"
    | "Duplicates"
    | "Documents"
    | "Reviewer";
  check_name: string;
  result: CheckResult;
  explanation: string;
  field_key?: string | null;
  source: string;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Checks that need no network access: completeness, formats, checksums and cross-field consistency.
 * A "fail" is something the vendor must fix; a "warning" is shown to the company only.
 */
export function offlineChecks(snapshot: FormSnapshot, rawValues: FormValues): Check[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const values: any = rawValues;
  const checks: Check[] = [];
  const fields = allFields(snapshot);
  const has = (k: string) => fields.some((f) => f.key === k);
  const label = (k: string) => fields.find((f) => f.key === k)?.label ?? k;

  // ---- Completeness
  const missing = fields.filter((f) => f.required && isEmptyValue(f, values[f.key]));
  for (const f of missing) {
    checks.push({
      category: "Completeness",
      check_name: `${f.label} provided`,
      result: "fail",
      explanation:
        f.input_type === "file"
          ? `Please upload ${f.label}.`
          : `${f.label} is required but was left blank.`,
      field_key: f.key,
      source: "form",
    });
  }
  if (!missing.length) {
    checks.push({
      category: "Completeness",
      check_name: "All required fields provided",
      result: "pass",
      explanation: `All ${fields.filter((f) => f.required).length} required fields are filled in.`,
      source: "form",
    });
  }

  // ---- Formats
  const formatRule = (key: string, name: string, fn: (v: unknown) => string | null) => {
    if (!has(key)) return;
    const v = values[key];
    if (!str(v)) return;
    const err = fn(v);
    checks.push({
      category: "Format",
      check_name: name,
      result: err ? "fail" : "pass",
      explanation: err ?? `${label(key)} is in a valid format.`,
      field_key: key,
      source: "format rules",
    });
  };
  formatRule("pan", "PAN format", validatePan);
  formatRule("gstin", "GSTIN format and check digit", validateGstin);
  formatRule("ifsc", "IFSC format", validateIfsc);
  formatRule("pin_code", "PIN code format", validatePin);
  formatRule("account_number", "Account number format", validateAccountNumber);
  for (const f of fields) {
    if (f.input_type === "email") formatRule(f.key, `${f.label} format`, validateEmail);
    if (f.input_type === "phone") formatRule(f.key, `${f.label} format`, validatePhone);
  }

  // ---- Consistency
  const pan = normaliseId(values.pan);
  const gstin = normaliseId(values.gstin);
  const panOk = pan && !validatePan(pan);
  const gstinOk = gstin && !validateGstin(gstin);

  if (
    has("confirm_account_number") &&
    str(values.account_number) &&
    str(values.confirm_account_number)
  ) {
    const same =
      str(values.account_number).replace(/\s+/g, "") ===
      str(values.confirm_account_number).replace(/\s+/g, "");
    checks.push({
      category: "Consistency",
      check_name: "Account number confirmation matches",
      result: same ? "pass" : "fail",
      explanation: same
        ? "Both account number entries match."
        : "Account Number and Confirm Account Number do not match.",
      field_key: "confirm_account_number",
      source: "form",
    });
  }

  if (panOk && gstinOk) {
    const embedded = gstin.slice(2, 12);
    checks.push({
      category: "Consistency",
      check_name: "GSTIN contains the PAN",
      result: embedded === pan ? "pass" : "fail",
      explanation:
        embedded === pan
          ? "Characters 3–12 of the GSTIN match the PAN."
          : `The PAN inside the GSTIN (${embedded}) does not match the PAN entered (${pan}).`,
      field_key: "gstin",
      source: "GSTIN structure",
    });
  }

  if (gstinOk && str(values.state)) {
    const gstState = GST_STATE_CODES[gstin.slice(0, 2)];
    const same = gstState?.toLowerCase() === str(values.state).toLowerCase();
    checks.push({
      category: "Consistency",
      check_name: "GSTIN state matches address state",
      result: same ? "pass" : "warning",
      explanation: same
        ? `GSTIN is registered in ${gstState}, matching the address.`
        : `GSTIN state code ${gstin.slice(0, 2)} is ${gstState}, but the address state is ${str(values.state)}. Fine if this is a branch registration.`,
      field_key: "state",
      source: "GSTIN structure",
    });
  }

  const bizType = str(values.business_type);
  if (panOk && bizType && BUSINESS_TYPE_PAN[bizType]) {
    const holder = pan[3] ?? "";
    const ok = (BUSINESS_TYPE_PAN[bizType] ?? []).includes(holder);
    checks.push({
      category: "Consistency",
      check_name: "PAN type matches business type",
      result: ok ? "pass" : "fail",
      explanation: ok
        ? `PAN belongs to a ${PAN_HOLDER_TYPES[holder]}, consistent with ${bizType}.`
        : `This PAN belongs to a ${PAN_HOLDER_TYPES[holder] ?? "different holder type"}, but the business type is ${bizType}. Use the business's own PAN, or correct the business type.`,
      field_key: "pan",
      source: "PAN structure",
    });
  }

  const taxPref = str(values.tax_preference);
  const regType = str(values.gst_registration_type);
  if (
    has("gstin") &&
    !gstin &&
    (taxPref === "Taxable" || regType === "Regular" || regType === "Composition")
  ) {
    checks.push({
      category: "Consistency",
      check_name: "GSTIN given for GST-registered vendor",
      result: "fail",
      explanation: `GSTIN is needed because the vendor is marked as ${regType || taxPref}. Enter the GSTIN, or change the registration type to Unregistered.`,
      field_key: "gstin",
      source: "form",
    });
  }
  if (gstin && regType === "Unregistered") {
    checks.push({
      category: "Consistency",
      check_name: "Registration type vs GSTIN",
      result: "warning",
      explanation: "A GSTIN was entered but the GST registration type is Unregistered.",
      field_key: "gst_registration_type",
      source: "form",
    });
  }
  if (values.composition_scheme === true && regType && regType !== "Composition") {
    checks.push({
      category: "Consistency",
      check_name: "Composition scheme vs registration type",
      result: "warning",
      explanation: `Composition scheme is ticked but the registration type is ${regType}.`,
      field_key: "composition_scheme",
      source: "form",
    });
  }

  const holderName = str(values.account_holder_name);
  const legalName = str(values.legal_business_name) || str(values.display_name);
  if (holderName && legalName) {
    const sim = nameSimilarity(holderName, legalName);
    checks.push({
      category: "Consistency",
      check_name: "Bank account holder matches business name",
      result: sim >= 0.5 ? "pass" : "warning",
      explanation:
        sim >= 0.5
          ? `Account holder "${holderName}" matches "${legalName}".`
          : `Account holder "${holderName}" looks different from the business name "${legalName}". Payments to third-party accounts need a closer look.`,
      field_key: "account_holder_name",
      source: "name matching",
    });
  }

  // ---- Documents
  for (const f of fields.filter((x) => x.input_type === "file")) {
    const v = values[f.key];
    if (!isFileList(v)) continue;
    for (const file of v) {
      const typeOk = Boolean(ACCEPTED_UPLOAD_TYPES[file.mime]);
      const sizeOk = file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
      if (!typeOk || !sizeOk) {
        checks.push({
          category: "Documents",
          check_name: `${f.label}: ${file.name}`,
          result: "fail",
          explanation: !typeOk
            ? `${file.name} must be a PDF, JPG or PNG.`
            : `${file.name} is empty or larger than 10 MB.`,
          field_key: f.key,
          source: "upload rules",
        });
      }
    }
  }
  const fileCount = fields
    .filter((x) => x.input_type === "file")
    .reduce((n, f) => n + (isFileList(values[f.key]) ? (values[f.key] as unknown[]).length : 0), 0);
  if (fileCount) {
    checks.push({
      category: "Documents",
      check_name: "Documents received",
      result: "pass",
      explanation: `${fileCount} document(s) uploaded.`,
      source: "upload rules",
    });
  }

  return checks;
}

/** Values cleaned up before storage: identifiers upper-cased, whitespace trimmed. */
export function normaliseValues(snapshot: FormSnapshot, values: FormValues): FormValues {
  const out: FormValues = {};
  for (const f of allFields(snapshot)) {
    const v = values[f.key];
    if (v === undefined) continue;
    if (typeof v === "string") {
      out[f.key] = ["pan", "gstin", "ifsc"].includes(f.key) ? normaliseId(v) : v.trim();
    } else {
      out[f.key] = v;
    }
  }
  return out;
}
