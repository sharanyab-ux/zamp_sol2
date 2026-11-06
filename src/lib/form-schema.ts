import type { LibraryFieldDef } from "./field-library";

export type InputType = LibraryFieldDef["input_type"];

export interface SnapshotField {
  key: string;
  label: string;
  description?: string | null;
  input_type: InputType;
  required: boolean;
  options?: string[];
  is_custom?: boolean;
}

export interface SnapshotSection {
  title: string;
  fields: SnapshotField[];
}

/** The frozen copy of a form that a vendor fills in (stored in form_versions.snapshot). */
export interface FormSnapshot {
  name: string;
  description?: string | null;
  version: number;
  sections: SnapshotSection[];
}

/** An uploaded file stored against a file field. */
export interface FileRef {
  path: string;
  name: string;
  mime: string;
  size: number;
}

export type FieldValue = string | boolean | string[] | FileRef[] | null | undefined;
export type FormValues = Record<string, FieldValue>;

export function isFileList(v: FieldValue): v is FileRef[] {
  return (
    Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null && "path" in v[0]
  );
}

export function isEmptyValue(field: SnapshotField, v: FieldValue): boolean {
  if (field.input_type === "checkbox") return false; // an unticked box is still an answer
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function displayValue(field: SnapshotField, v: FieldValue): string {
  if (field.input_type === "checkbox") return v ? "Yes" : "No";
  if (v === null || v === undefined || v === "") return "—";
  if (isFileList(v)) return v.map((f) => f.name).join(", ");
  if (Array.isArray(v)) return (v as string[]).join(", ");
  return String(v);
}

export function allFields(snapshot: FormSnapshot): SnapshotField[] {
  return snapshot.sections.flatMap((s) => s.fields);
}

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  text: "Short text",
  number: "Number",
  email: "Email",
  phone: "Phone",
  date: "Date",
  dropdown: "Dropdown",
  multiselect: "Multi-select",
  checkbox: "Checkbox",
  radio: "Single choice",
  file: "File upload",
};
