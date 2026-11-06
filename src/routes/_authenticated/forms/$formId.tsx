import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Mail,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { VendorForm } from "@/components/vendor-form";
import { DEFAULT_SECTIONS, FIELD_LIBRARY, type FieldCategory } from "@/lib/field-library";
import { INPUT_TYPE_LABELS, type InputType } from "@/lib/form-schema";
import {
  loadBuilderForm,
  publishForm,
  saveForm,
  toSnapshot,
  uid,
  type BuilderField,
  type BuilderForm,
  type BuilderSection,
} from "@/lib/forms";
import { canEdit, formatDate, useWorkspace } from "@/lib/workspace";
import { vendorStatus, type InvitationStatus, type SubmissionStatus } from "@/lib/status";
import { resendInvitation, revokeInvitation, sendInvitations } from "@/lib/workspace.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/forms/$formId")({
  head: () => ({ meta: [{ title: "Form builder — TendToVend" }] }),
  component: FormBuilderPage,
});

const SECTION_FOR_CATEGORY: Record<FieldCategory, string> = Object.fromEntries(
  DEFAULT_SECTIONS.flatMap((s) => s.categories.map((c) => [c, s.title])),
) as Record<FieldCategory, string>;

function FormBuilderPage() {
  const { formId } = Route.useParams();
  const { data: ws } = useWorkspace();
  const editable = canEdit(ws);
  const qc = useQueryClient();

  const { data: loaded, isLoading } = useQuery({
    queryKey: ["form", formId],
    queryFn: () => loadBuilderForm(formId),
  });
  const [form, setForm] = useState<BuilderForm | null>(null);
  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [tab, setTab] = useState("build");
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    if (loaded && !dirty) {
      setForm(loaded);
      setSections(loaded.sections);
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const usedKeys = useMemo(
    () => new Set(sections.flatMap((s) => s.fields.map((f) => f.key))),
    [sections],
  );

  const update = (fn: (s: BuilderSection[]) => BuilderSection[]) => {
    setSections((prev) => fn(prev));
    setDirty(true);
  };

  function toggleLibraryField(cat: FieldCategory, key: string) {
    if (usedKeys.has(key)) {
      update((ss) => ss.map((s) => ({ ...s, fields: s.fields.filter((f) => f.key !== key) })));
      return;
    }
    const def = FIELD_LIBRARY.find((c) => c.id === cat)!.fields.find((f) => f.key === key)!;
    const field: BuilderField = {
      uid: uid(),
      key,
      label: def.label,
      description: def.description ?? null,
      input_type: def.input_type,
      required: def.required_default,
      options: def.options ?? [],
      is_custom: false,
    };
    const title = SECTION_FOR_CATEGORY[cat];
    update((ss) => {
      const i = ss.findIndex((s) => s.title === title);
      if (i >= 0) return ss.map((s, j) => (j === i ? { ...s, fields: [...s.fields, field] } : s));
      return [...ss, { uid: uid(), title, is_custom: false, fields: [field] }];
    });
  }

  const patchField = (su: string, fu: string, patch: Partial<BuilderField>) =>
    update((ss) =>
      ss.map((s) =>
        s.uid !== su
          ? s
          : { ...s, fields: s.fields.map((f) => (f.uid === fu ? { ...f, ...patch } : f)) },
      ),
    );

  const moveField = (su: string, idx: number, dir: -1 | 1) =>
    update((ss) =>
      ss.map((s) => {
        if (s.uid !== su) return s;
        const fields = [...s.fields];
        const j = idx + dir;
        if (j < 0 || j >= fields.length) return s;
        [fields[idx], fields[j]] = [fields[j]!, fields[idx]!];
        return { ...s, fields };
      }),
    );

  const moveSection = (idx: number, dir: -1 | 1) =>
    update((ss) => {
      const out = [...ss];
      const j = idx + dir;
      if (j < 0 || j >= out.length) return ss;
      [out[idx], out[j]] = [out[j]!, out[idx]!];
      return out;
    });

  async function save() {
    if (!form) return;
    setBusy("save");
    try {
      await saveForm(form, sections);
      setDirty(false);
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["form", formId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!form) return;
    setBusy("publish");
    try {
      const v = await publishForm(form, sections);
      setDirty(false);
      setForm({ ...form, status: "published", current_version: v });
      toast.success(`Published version ${v}. You can now invite vendors.`);
      qc.invalidateQueries({ queryKey: ["form", formId] });
      setTab("invite");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || (!form && loaded !== null))
    return <p className="p-8 text-sm text-muted-foreground">Loading form…</p>;
  if (!form) return <p className="p-8 text-sm text-muted-foreground">Form not found.</p>;

  const fieldCount = sections.reduce((n, s) => n + s.fields.length, 0);

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 px-4 py-4 backdrop-blur sm:px-8">
        <Link
          to="/forms"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All forms
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Input
              value={form.name}
              readOnly={!editable}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setDirty(true);
              }}
              aria-label="Form name"
              className="h-10 max-w-md border-transparent px-2 font-display text-xl font-bold shadow-none hover:border-input focus-visible:border-input"
            />
            <StatusBadge
              label={form.status === "published" ? `Published v${form.current_version}` : "Draft"}
              tone={form.status === "published" ? "success" : "neutral"}
            />
            {dirty && (
              <span className="text-xs font-medium text-warning-foreground">Unsaved changes</span>
            )}
          </div>
          {editable && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={save} disabled={!dirty || busy !== null}>
                {busy === "save" ? "Saving…" : "Save draft"}
              </Button>
              <Button onClick={publish} disabled={busy !== null} className="font-semibold">
                {busy === "publish"
                  ? "Publishing…"
                  : form.status === "published"
                    ? dirty
                      ? "Publish changes"
                      : "Republish"
                    : "Publish"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="px-4 py-6 sm:px-8">
        <TabsList>
          <TabsTrigger value="build">1. Build</TabsTrigger>
          <TabsTrigger value="preview">2. Preview</TabsTrigger>
          <TabsTrigger value="invite">3. Invite vendors</TabsTrigger>
        </TabsList>

        {/* ---------------- BUILD ---------------- */}
        <TabsContent value="build" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-3 lg:sticky lg:top-40 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto">
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Field library</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tick a field to add it to the form. Untick to remove it.
                </p>
              </div>
              {FIELD_LIBRARY.map((cat) => (
                <LibraryGroup
                  key={cat.id}
                  name={cat.name}
                  count={cat.fields.filter((f) => usedKeys.has(f.key)).length}
                  total={cat.fields.length}
                >
                  {cat.fields.map((f) => (
                    <label
                      key={f.key}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={usedKeys.has(f.key)}
                        disabled={!editable}
                        onCheckedChange={() => toggleLibraryField(cat.id, f.key)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block">{f.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {INPUT_TYPE_LABELS[f.input_type]}
                        </span>
                      </span>
                    </label>
                  ))}
                </LibraryGroup>
              ))}
              {editable && (
                <Button variant="outline" className="w-full" onClick={() => setCustomOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Add a custom field
                </Button>
              )}
            </aside>

            <div className="space-y-5">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {sections.length} sections · {fieldCount} fields ·{" "}
                  {sections.reduce((n, s) => n + s.fields.filter((f) => f.required).length, 0)}{" "}
                  required
                </span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update((ss) => [
                        ...ss,
                        { uid: uid(), title: "New section", is_custom: true, fields: [] },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> Section
                  </Button>
                )}
              </div>
              {sections.map((s, si) => (
                <section key={s.uid} className="rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <Input
                      value={s.title}
                      readOnly={!editable}
                      onChange={(e) =>
                        update((ss) =>
                          ss.map((x) => (x.uid === s.uid ? { ...x, title: e.target.value } : x)),
                        )
                      }
                      aria-label="Section title"
                      className="h-9 border-transparent px-2 font-semibold shadow-none hover:border-input focus-visible:border-input"
                    />
                    {editable && (
                      <div className="flex shrink-0 items-center">
                        <IconBtn
                          label="Move section up"
                          onClick={() => moveSection(si, -1)}
                          disabled={si === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn
                          label="Move section down"
                          onClick={() => moveSection(si, 1)}
                          disabled={si === sections.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn
                          label="Delete section"
                          onClick={() => update((ss) => ss.filter((x) => x.uid !== s.uid))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    )}
                  </div>
                  {s.fields.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Empty — tick fields in the library or add a custom field.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {s.fields.map((f, fi) => (
                        <li
                          key={f.uid}
                          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <Input
                              value={f.label}
                              readOnly={!editable}
                              onChange={(e) => patchField(s.uid, f.uid, { label: e.target.value })}
                              aria-label="Field label"
                              className="h-8 border-transparent px-2 text-sm font-medium shadow-none hover:border-input focus-visible:border-input"
                            />
                            <div className="px-2 text-xs text-muted-foreground">
                              {INPUT_TYPE_LABELS[f.input_type]}
                              {f.options.length > 0 && ` · ${f.options.length} options`}
                              {f.is_custom && " · custom"}
                              {[
                                "pan",
                                "gstin",
                                "ifsc",
                                "pin_code",
                                "account_number",
                                "bank_name",
                                "legal_business_name",
                              ].includes(f.key) && " · auto-verified"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 sm:shrink-0">
                            <label className="flex items-center gap-2 text-xs font-medium">
                              <Switch
                                checked={f.required}
                                disabled={!editable}
                                onCheckedChange={(c) => patchField(s.uid, f.uid, { required: c })}
                              />
                              Required
                            </label>
                            {editable && (
                              <div className="flex items-center">
                                <IconBtn
                                  label="Move up"
                                  onClick={() => moveField(s.uid, fi, -1)}
                                  disabled={fi === 0}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </IconBtn>
                                <IconBtn
                                  label="Move down"
                                  onClick={() => moveField(s.uid, fi, 1)}
                                  disabled={fi === s.fields.length - 1}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </IconBtn>
                                <IconBtn
                                  label="Remove field"
                                  onClick={() =>
                                    update((ss) =>
                                      ss.map((x) =>
                                        x.uid === s.uid
                                          ? {
                                              ...x,
                                              fields: x.fields.filter((y) => y.uid !== f.uid),
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </IconBtn>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ---------------- PREVIEW ---------------- */}
        <TabsContent value="preview" className="mt-6">
          <div className="mx-auto max-w-3xl">
            <p className="mb-4 text-sm text-muted-foreground">
              This is what vendors see. Inputs are live here so you can try the instant format hints
              (e.g. type a PAN).
            </p>
            <PreviewForm snapshot={toSnapshot(form, sections, form.current_version)} />
          </div>
        </TabsContent>

        {/* ---------------- INVITE ---------------- */}
        <TabsContent value="invite" className="mt-6">
          <InvitePanel
            formId={form.id}
            published={form.status === "published"}
            dirty={dirty}
            editable={editable}
          />
        </TabsContent>
      </Tabs>

      <CustomFieldDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        sections={sections}
        usedKeys={usedKeys}
        onAdd={(sectionUid, field) =>
          update((ss) =>
            ss.map((s) => (s.uid === sectionUid ? { ...s, fields: [...s.fields, field] } : s)),
          )
        }
      />
    </div>
  );
}

function PreviewForm({ snapshot }: { snapshot: ReturnType<typeof toSnapshot> }) {
  const [values, setValues] = useState({});
  return (
    <VendorForm
      snapshot={snapshot}
      values={values}
      onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))}
    />
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function LibraryGroup({
  name,
  count,
  total,
  children,
}: {
  name: string;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold">{name}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {count}/{total}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && <div className="space-y-0.5 px-2 pb-3">{children}</div>}
    </div>
  );
}

const CUSTOM_TYPES: InputType[] = [
  "text",
  "number",
  "email",
  "phone",
  "date",
  "dropdown",
  "radio",
  "multiselect",
  "checkbox",
  "file",
];

function CustomFieldDialog({
  open,
  onOpenChange,
  sections,
  usedKeys,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sections: BuilderSection[];
  usedKeys: Set<string>;
  onAdd: (sectionUid: string, f: BuilderField) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<InputType>("text");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState("");
  const [description, setDescription] = useState("");
  const [sectionUid, setSectionUid] = useState("");

  useEffect(() => {
    if (open) {
      setLabel("");
      setType("text");
      setRequired(false);
      setOptions("");
      setDescription("");
      setSectionUid(sections.at(-1)?.uid ?? "");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsOptions = type === "dropdown" || type === "radio" || type === "multiselect";
  const opts = options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  const valid = label.trim() && sectionUid && (!needsOptions || opts.length >= 2);

  function add() {
    let key =
      "custom_" +
      label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40);
    while (usedKeys.has(key)) key += "_" + Math.random().toString(36).slice(2, 5);
    onAdd(sectionUid, {
      uid: uid(),
      key,
      label: label.trim(),
      description: description.trim() || null,
      input_type: type,
      required,
      options: needsOptions ? opts : [],
      is_custom: true,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a custom field</DialogTitle>
        </DialogHeader>
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a section first.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="cf-label">
                Label
              </label>
              <Input
                id="cf-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. MSME / Udyam number"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Type</span>
                <Select value={type} onValueChange={(v) => setType(v as InputType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {INPUT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Section</span>
                <Select value={sectionUid} onValueChange={setSectionUid}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.uid} value={s.uid}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {needsOptions && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cf-opts">
                  Options (one per line)
                </label>
                <Textarea
                  id="cf-opts"
                  rows={4}
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="cf-desc">
                Help text (optional)
              </label>
              <Input
                id="cf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={required} onCheckedChange={setRequired} /> Required
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={add} disabled={!valid} className="font-semibold">
            Add field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ invite panel

type Row = { name: string; email: string };

function parseList(text: string): Row[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const email = l.match(/[^\s,;<>]+@[^\s,;<>]+/)?.[0] ?? "";
      const name =
        l
          .replace(email, "")
          .replace(/[<>,;]+/g, " ")
          .trim() ||
        email.split("@")[0] ||
        "";
      return { name, email };
    });
}

function InvitePanel({
  formId,
  published,
  dirty,
  editable,
}: {
  formId: string;
  published: boolean;
  dirty: boolean;
  editable: boolean;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([{ name: "", email: "" }]);
  const [bulk, setBulk] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<
    | { name: string; email: string; link: string; emailed: boolean; error?: string | undefined }[]
    | null
  >(null);

  const { data: invites } = useQuery({
    queryKey: ["invites", formId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invitations")
        .select(
          "id, vendor_name, vendor_email, token, status, expires_at, sent_at, resend_count, submissions(status)",
        )
        .eq("form_id", formId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const all = [...rows.filter((r) => r.email.trim()), ...parseList(bulk)];
  const invalid = all.filter(
    (r) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.email.trim()) || !r.name.trim(),
  );

  async function send() {
    setSending(true);
    try {
      const res = await sendInvitations({
        data: {
          formId,
          vendors: all.map((r) => ({ name: r.name.trim(), email: r.email.trim() })),
          expiresInDays: 30,
        },
      });
      setResults(res.results);
      setRows([{ name: "", email: "" }]);
      setBulk("");
      const ok = res.results.filter((r) => r.link).length;
      toast.success(
        res.emailConfigured
          ? `${ok} invitation(s) created and emailed`
          : `${ok} link(s) created — email is not set up yet, so copy and send them yourself`,
      );
      qc.invalidateQueries({ queryKey: ["invites", formId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send invitations");
    } finally {
      setSending(false);
    }
  }

  const copy = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };

  if (!published)
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <h2 className="text-lg font-semibold">Publish the form first</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Vendors always get a frozen, published version — so later edits never change a form
          someone is halfway through.
        </p>
      </div>
    );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      {editable && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-base font-semibold">Send the form to vendors</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each vendor gets their own secure link, valid for 30 days.
            </p>
            {dirty && (
              <p className="mt-2 text-xs font-medium text-warning-foreground">
                You have unpublished edits — vendors will get the last published version.
              </p>
            )}
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Vendor name"
                value={r.name}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <Input
                placeholder="vendor@email.com"
                type="email"
                value={r.email}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                }
              />
              {rows.length > 1 && (
                <IconBtn label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </IconBtn>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRows([...rows, { name: "", email: "" }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Another vendor
          </Button>
          <div className="space-y-1.5">
            <label htmlFor="bulk" className="text-sm font-medium">
              Or paste a list
            </label>
            <Textarea
              id="bulk"
              rows={4}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={
                "Sharma Traders, accounts@sharmatraders.in\nKaveri Packaging <hello@kaveripack.com>"
              }
            />
          </div>
          {invalid.length > 0 && (
            <p className="text-xs font-medium text-destructive">
              {invalid.length} row(s) need a name and a valid email.
            </p>
          )}
          <Button
            className="w-full font-semibold"
            onClick={send}
            disabled={sending || !all.length || invalid.length > 0}
          >
            <Mail className="mr-1.5 h-4 w-4" />
            {sending
              ? "Sending…"
              : `Send to ${all.length || ""} vendor${all.length === 1 ? "" : "s"}`}
          </Button>

          {results && (
            <div className="space-y-2 border-t border-border pt-4">
              {results.map((r) => (
                <div key={r.email} className="rounded-md bg-muted/60 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.name}</span>
                    {r.emailed ? (
                      <span className="flex items-center gap-1 text-success">
                        <Check className="h-3.5 w-3.5" /> Emailed
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not emailed</span>
                    )}
                  </div>
                  {r.link ? (
                    <button
                      onClick={() => copy(r.link)}
                      className="mt-1 flex w-full items-center gap-1.5 truncate text-left text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5 shrink-0" />{" "}
                      <span className="truncate">{r.link}</span>
                    </button>
                  ) : (
                    <p className="mt-1 text-destructive">{r.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold">
          Vendors invited with this form
        </h2>
        {!invites?.length ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No one invited yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {invites.map((i) => {
              const sub =
                (i.submissions as unknown as { status: SubmissionStatus }[] | null)?.[0] ?? null;
              const view = vendorStatus(
                { status: i.status as InvitationStatus, expires_at: i.expires_at },
                sub,
              );
              const link = `${window.location.origin}/v/${i.token}`;
              return (
                <li
                  key={i.id}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    to="/vendors/$invitationId"
                    params={{ invitationId: i.id }}
                    className="min-w-0 hover:underline"
                  >
                    <div className="truncate text-sm font-medium">{i.vendor_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {i.vendor_email} · sent {formatDate(i.sent_at)}
                    </div>
                  </Link>
                  <div className="flex items-center gap-1">
                    <StatusBadge label={view.label} tone={view.tone} />
                    <IconBtn label="Copy link" onClick={() => copy(link)}>
                      <Copy className="h-4 w-4" />
                    </IconBtn>
                    {editable && !sub && (
                      <IconBtn
                        label="Resend email"
                        onClick={async () => {
                          try {
                            const r = await resendInvitation({ data: { invitationId: i.id } });
                            toast[r.emailed ? "success" : "warning"](
                              r.emailed
                                ? "Invitation re-sent"
                                : `Not emailed: ${r.error}. Link copied instead.`,
                            );
                            if (!r.emailed) navigator.clipboard.writeText(r.link);
                            qc.invalidateQueries({ queryKey: ["invites", formId] });
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Could not resend");
                          }
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </IconBtn>
                    )}
                    {editable && !sub && i.status !== "revoked" && (
                      <IconBtn
                        label="Revoke link"
                        onClick={async () => {
                          await revokeInvitation({ data: { invitationId: i.id } });
                          toast.success("Link revoked");
                          qc.invalidateQueries({ queryKey: ["invites", formId] });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
