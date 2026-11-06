import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { canEdit, formatDate, useWorkspace } from "@/lib/workspace";
import { createStarterForm } from "@/lib/forms";

export const Route = createFileRoute("/_authenticated/forms/")({
  head: () => ({ meta: [{ title: "Forms — TendToVend" }] }),
  component: FormsPage,
});

function FormsPage() {
  const { data: ws } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Vendor registration");
  const [creating, setCreating] = useState(false);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["forms", ws?.org.id],
    enabled: Boolean(ws),
    queryFn: async () => {
      const { data } = await supabase
        .from("forms")
        .select(
          "id, name, status, current_version, updated_at, invitations(count), form_fields(count)",
        )
        .eq("organisation_id", ws!.org.id)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  async function create() {
    if (!ws || !name.trim()) return;
    setCreating(true);
    try {
      const id = await createStarterForm(ws.org.id, name.trim());
      navigate({ to: "/forms/$formId", params: { formId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create form");
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Forms"
        description="Build the registration form your vendors fill in, then send it to them by email."
        actions={
          canEdit(ws) && (
            <Button onClick={() => setOpen(true)} className="font-semibold">
              <Plus className="mr-1 h-4 w-4" /> New form
            </Button>
          )
        }
      />
      <div className="px-4 py-8 sm:px-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !forms?.length ? (
          <div className="mx-auto max-w-lg rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <h2 className="text-lg font-semibold">No forms yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with a ready-made Indian vendor form — contact, identity (PAN, city), tax
              (GSTIN, tax preference), bank and documents — and tailor it.
            </p>
            {canEdit(ws) && (
              <Button className="mt-6 font-semibold" onClick={() => setOpen(true)}>
                Create your first form
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {forms.map((f) => (
              <Link
                key={f.id}
                to="/forms/$formId"
                params={{ formId: f.id }}
                className="card-hover rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{f.name}</h3>
                  <StatusBadge
                    label={
                      f.status === "published"
                        ? `Published v${f.current_version}`
                        : f.status === "draft"
                          ? "Draft"
                          : "Archived"
                    }
                    tone={f.status === "published" ? "success" : "neutral"}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {(f.form_fields as unknown as { count: number }[])[0]?.count ?? 0} fields ·{" "}
                  {(f.invitations as unknown as { count: number }[])[0]?.count ?? 0} vendors invited
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updated {formatDate(f.updated_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New vendor form</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="form-name" className="text-sm font-medium">
              Form name
            </label>
            <Input
              id="form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <p className="text-xs text-muted-foreground">
              It starts with the common fields filled in. You can add, remove or reorder anything
              next.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={creating || !name.trim()} className="font-semibold">
              {creating ? "Creating…" : "Create form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
