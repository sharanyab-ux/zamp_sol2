import { useState } from "react";
import { AlertCircle, FileText, Loader2, Paperclip, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ACCEPTED_UPLOAD_TYPES } from "@/lib/field-library";
import {
  isFileList,
  type FieldValue,
  type FileRef,
  type FormSnapshot,
  type FormValues,
  type SnapshotField,
} from "@/lib/form-schema";
import { quickFieldError } from "@/lib/validators";

export interface VendorFormProps {
  snapshot: FormSnapshot;
  values: FormValues;
  onChange?: (key: string, value: FieldValue) => void;
  /** Issues from the last verification run, keyed by field. */
  issues?: Record<string, string[]>;
  readOnly?: boolean | undefined;
  upload?: ((field: SnapshotField, file: File) => Promise<FileRef>) | undefined;
}

export function VendorForm({
  snapshot,
  values,
  onChange,
  issues = {},
  readOnly,
  upload,
}: VendorFormProps) {
  return (
    <div className="space-y-6">
      {snapshot.sections.map((section, si) => (
        <section key={si} className="rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-4 text-base font-semibold sm:px-6">
            {section.title}
          </h2>
          <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
            {section.fields.map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={values[f.key]}
                onChange={(v) => onChange?.(f.key, v)}
                issues={issues[f.key]}
                readOnly={readOnly}
                upload={upload}
              />
            ))}
            {section.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">No fields in this section.</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  issues,
  readOnly,
  upload,
}: {
  field: SnapshotField;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  issues?: string[] | undefined;
  readOnly?: boolean | undefined;
  upload?: VendorFormProps["upload"] | undefined;
}) {
  const [touched, setTouched] = useState(false);
  const hint = touched ? quickFieldError(field.key, field.input_type, value) : null;
  const errors = [...(issues ?? []), ...(hint && !(issues ?? []).length ? [hint] : [])];
  const id = `f-${field.key}`;
  const wide =
    field.input_type === "file" ||
    field.input_type === "multiselect" ||
    field.key === "registered_address";
  const strVal = typeof value === "string" ? value : "";

  let control: React.ReactNode;
  switch (field.input_type) {
    case "dropdown":
      control = (
        <Select value={strVal} onValueChange={(v) => onChange(v)} disabled={Boolean(readOnly)}>
          <SelectTrigger id={id} aria-invalid={errors.length > 0}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "radio":
      control = (
        <RadioGroup
          value={strVal}
          onValueChange={(v) => onChange(v)}
          disabled={readOnly}
          className="flex flex-wrap gap-4 pt-1"
        >
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={o} /> {o}
            </label>
          ))}
        </RadioGroup>
      );
      break;
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={arr.includes(o)}
                disabled={readOnly}
                onCheckedChange={(c) => onChange(c ? [...arr, o] : arr.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    }
    case "checkbox":
      control = (
        <label className="flex items-center gap-2 pt-1 text-sm">
          <Checkbox
            id={id}
            checked={value === true}
            disabled={readOnly}
            onCheckedChange={(c) => onChange(c === true)}
          />
          Yes
        </label>
      );
      break;
    case "file":
      control = (
        <FileField
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          upload={upload}
        />
      );
      break;
    default:
      control = (
        <Input
          id={id}
          type={
            field.input_type === "email"
              ? "email"
              : field.input_type === "date"
                ? "date"
                : field.input_type === "number"
                  ? "number"
                  : field.input_type === "phone"
                    ? "tel"
                    : "text"
          }
          value={strVal}
          readOnly={readOnly}
          aria-invalid={errors.length > 0}
          autoComplete="off"
          onBlur={() => setTouched(true)}
          onChange={(e) =>
            onChange(
              ["pan", "gstin", "ifsc"].includes(field.key)
                ? e.target.value.toUpperCase()
                : e.target.value,
            )
          }
          className={cn(
            ["pan", "gstin", "ifsc"].includes(field.key) && "font-mono uppercase tracking-wide",
          )}
        />
      );
  }

  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <Label htmlFor={id} className="mb-1.5 flex items-center gap-1 text-sm font-medium">
        {field.label}
        {field.required ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        )}
      </Label>
      {field.description && (
        <p className="mb-1.5 text-xs text-muted-foreground">{field.description}</p>
      )}
      {control}
      {errors.map((e, i) => (
        <p key={i} className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {e}
        </p>
      ))}
    </div>
  );
}

function FileField({
  field,
  value,
  onChange,
  readOnly,
  upload,
}: {
  field: SnapshotField;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  readOnly?: boolean | undefined;
  upload?: VendorFormProps["upload"] | undefined;
}) {
  const files = isFileList(value) ? value : [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(list: FileList | null) {
    if (!list?.length || !upload) return;
    setErr(null);
    setBusy(true);
    const added: FileRef[] = [];
    try {
      for (const f of Array.from(list)) {
        if (!ACCEPTED_UPLOAD_TYPES[f.type])
          throw new Error(`${f.name}: only PDF, JPG or PNG files are accepted.`);
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is larger than 10 MB.`);
        added.push(await upload(field, f));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (added.length) onChange([...files, ...added]);
      setBusy(false);
    }
  }

  return (
    <div>
      {files.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {files.map((f) => (
            <li
              key={f.path}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onChange(files.filter((x) => x.path !== f.path))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <label
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-4 py-3 text-sm text-muted-foreground hover:border-ring hover:text-foreground",
            busy && "pointer-events-none opacity-60",
            !upload && "pointer-events-none",
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {busy
            ? "Uploading…"
            : files.length
              ? "Add another file"
              : "Upload PDF, JPG or PNG (max 10 MB)"}
          <input
            type="file"
            className="sr-only"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={!upload || busy}
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {readOnly && files.length === 0 && (
        <p className="text-sm text-muted-foreground">No file uploaded.</p>
      )}
      {err && <p className="mt-1.5 text-xs font-medium text-destructive">{err}</p>}
    </div>
  );
}
