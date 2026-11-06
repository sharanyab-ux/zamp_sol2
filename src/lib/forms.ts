import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { DEFAULT_SECTIONS, FIELD_LIBRARY, STARTER_FIELD_KEYS } from "./field-library";
import type { FormSnapshot, InputType } from "./form-schema";

export interface BuilderField {
  uid: string;
  key: string;
  label: string;
  description: string | null;
  input_type: InputType;
  required: boolean;
  options: string[];
  is_custom: boolean;
}

export interface BuilderSection {
  uid: string;
  title: string;
  is_custom: boolean;
  fields: BuilderField[];
}

export interface BuilderForm {
  id: string;
  organisation_id: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  current_version: number;
  sections: BuilderSection[];
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export async function createStarterForm(orgId: string, name: string): Promise<string> {
  const { data: form, error } = await supabase
    .from("forms")
    .insert({ organisation_id: orgId, name, status: "draft" })
    .select("id")
    .single();
  if (error || !form) throw new Error(error?.message ?? "Could not create form");
  const sections: BuilderSection[] = DEFAULT_SECTIONS.map((s) => ({
    uid: uid(),
    title: s.title,
    is_custom: false,
    fields: s.categories
      .flatMap((c) => FIELD_LIBRARY.find((x) => x.id === c)!.fields)
      .filter((f) => STARTER_FIELD_KEYS.includes(f.key))
      .map((f) => ({
        uid: uid(),
        key: f.key,
        label: f.label,
        description: f.description ?? null,
        input_type: f.input_type,
        required: f.required_default,
        options: f.options ?? [],
        is_custom: false,
      })),
  }));
  await saveSections(form.id, sections);
  return form.id;
}

export async function loadBuilderForm(formId: string): Promise<BuilderForm | null> {
  const [{ data: form }, { data: sections }, { data: fields }] = await Promise.all([
    supabase
      .from("forms")
      .select("id, organisation_id, name, description, status, current_version")
      .eq("id", formId)
      .maybeSingle(),
    supabase
      .from("form_sections")
      .select("id, title, position, is_custom")
      .eq("form_id", formId)
      .order("position"),
    supabase
      .from("form_fields")
      .select(
        "section_id, field_key, label, description, input_type, required, position, is_custom, config",
      )
      .eq("form_id", formId)
      .order("position"),
  ]);
  if (!form) return null;
  return {
    ...form,
    status: form.status as BuilderForm["status"],
    sections: (sections ?? []).map((s) => ({
      uid: s.id,
      title: s.title,
      is_custom: s.is_custom,
      fields: (fields ?? [])
        .filter((f) => f.section_id === s.id)
        .map((f) => ({
          uid: uid(),
          key: f.field_key,
          label: f.label,
          description: f.description,
          input_type: f.input_type as InputType,
          required: f.required,
          options: ((f.config as { options?: string[] } | null)?.options ?? []) as string[],
          is_custom: f.is_custom,
        })),
    })),
  };
}

/** Replace the form's sections/fields with the builder state. */
export async function saveSections(formId: string, sections: BuilderSection[]) {
  const { error: delErr } = await supabase.from("form_sections").delete().eq("form_id", formId);
  if (delErr) throw new Error(delErr.message);
  if (!sections.length) return;
  const { data: rows, error } = await supabase
    .from("form_sections")
    .insert(
      sections.map((s, i) => ({
        form_id: formId,
        title: s.title.trim() || "Untitled section",
        position: i,
        is_custom: s.is_custom,
      })),
    )
    .select("id, position");
  if (error || !rows) throw new Error(error?.message ?? "Could not save sections");
  const fields = sections.flatMap((s, si) =>
    s.fields.map((f, fi) => ({
      form_id: formId,
      section_id: rows.find((r) => r.position === si)!.id,
      field_key: f.key,
      label: f.label.trim() || "Untitled field",
      description: f.description,
      input_type: f.input_type,
      required: f.required,
      position: fi,
      is_custom: f.is_custom,
      config: { options: f.options } as Json,
    })),
  );
  if (fields.length) {
    const { error: fErr } = await supabase.from("form_fields").insert(fields);
    if (fErr) throw new Error(fErr.message);
  }
}

export function toSnapshot(
  form: Pick<BuilderForm, "name" | "description">,
  sections: BuilderSection[],
  version: number,
): FormSnapshot {
  return {
    name: form.name,
    description: form.description,
    version,
    sections: sections
      .filter((s) => s.fields.length)
      .map((s) => ({
        title: s.title.trim() || "Untitled section",
        fields: s.fields.map((f) => ({
          key: f.key,
          label: f.label.trim() || "Untitled field",
          description: f.description,
          input_type: f.input_type,
          required: f.required,
          ...(f.options.length ? { options: f.options } : {}),
          is_custom: f.is_custom,
        })),
      })),
  };
}

export async function saveForm(form: BuilderForm, sections: BuilderSection[]) {
  const { error } = await supabase
    .from("forms")
    .update({
      name: form.name.trim() || "Untitled form",
      description: form.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", form.id);
  if (error) throw new Error(error.message);
  await saveSections(form.id, sections);
}

export async function publishForm(form: BuilderForm, sections: BuilderSection[]): Promise<number> {
  if (!sections.some((s) => s.fields.length))
    throw new Error("Add at least one field before publishing.");
  await saveForm(form, sections);
  const version = (form.current_version ?? 0) + 1;
  const { error } = await supabase.from("form_versions").insert({
    form_id: form.id,
    organisation_id: form.organisation_id,
    version,
    snapshot: toSnapshot(form, sections, version) as unknown as Json,
  });
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase
    .from("forms")
    .update({
      status: "published",
      current_version: version,
      draft_version: version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", form.id);
  if (e2) throw new Error(e2.message);
  return version;
}
