import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/workspace";

export interface TimelineEvent {
  at: string;
  label: string;
  by?: string;
  note?: string;
}

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className={cn("relative space-y-4 border-l border-border pl-5", className)}>
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span
            className={cn(
              "absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-card",
              i === events.length - 1 ? "bg-primary" : "bg-navy/40",
            )}
          />
          <div className="text-sm font-medium">{e.label}</div>
          <div className="text-xs text-muted-foreground">
            {formatDate(e.at, true)}
            {e.by ? ` · ${e.by}` : ""}
          </div>
          {e.note && <div className="mt-1 text-xs text-muted-foreground">{e.note}</div>}
        </li>
      ))}
    </ol>
  );
}
