import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BadgeCheck, FileText, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { TtvLogo } from "@/components/ttv-logo";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/forms", label: "Forms", icon: FileText },
  { to: "/vendors", label: "Vendors", icon: Users },
  { to: "/approved", label: "Approved vendors", icon: BadgeCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: ws } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/signin", replace: true });
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white"
          activeProps={{ className: "!bg-sidebar-accent !text-white" }}
        >
          <n.icon className="h-4 w-4" />
          {n.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-sidebar-border p-4">
      {ws && (
        <div className="mb-3 text-xs text-sidebar-foreground/70">
          <div className="truncate font-semibold text-white">{ws.org.name}</div>
          <div className="truncate">
            {ws.displayName} · <span className="capitalize">{ws.role}</span>
          </div>
        </div>
      )}
      <button
        onClick={signOut}
        className="flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-white"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar lg:flex">
        <div className="px-5 py-5">
          <Link to="/dashboard">
            <TtvLogo variant="light" size={30} />
          </Link>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header className="flex h-14 items-center justify-between bg-sidebar px-4 lg:hidden">
        <TtvLogo variant="light" size={26} />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="text-white">
          <Menu className="h-6 w-6" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex w-64 flex-col bg-sidebar">
            <div className="flex items-center justify-between px-5 py-4">
              <TtvLogo variant="light" size={26} />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border bg-card px-4 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
