import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Workspace {
  userId: string;
  role: "owner" | "admin" | "reviewer";
  displayName: string;
  org: {
    id: string;
    name: string;
    contact_person: string;
    contact_email: string;
    phone: string | null;
  };
}

export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    staleTime: 60_000,
    queryFn: async (): Promise<Workspace | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("organisation_members")
        .select(
          "role, display_name, organisation:organisations(id, name, contact_person, contact_email, phone)",
        )
        .eq("user_id", u.user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!data?.organisation) return null;
      return {
        userId: u.user.id,
        role: data.role as Workspace["role"],
        displayName: data.display_name,
        org: data.organisation as unknown as Workspace["org"],
      };
    },
  });
}

export const canEdit = (w: Workspace | null | undefined) =>
  w?.role === "owner" || w?.role === "admin";

export function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}
