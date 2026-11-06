import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "@/lib/status";

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

const CHECK_TONES: Record<string, { label: string; tone: Tone }> = {
  pass: { label: "Passed", tone: "success" },
  fail: { label: "Needs fixing", tone: "danger" },
  warning: { label: "Review", tone: "warning" },
  not_verified: { label: "Not verified", tone: "neutral" },
  manual_review: { label: "Manual review", tone: "info" },
};

export function CheckBadge({ result }: { result: string }) {
  const c = CHECK_TONES[result] ?? { label: result, tone: "neutral" as Tone };
  return <StatusBadge label={c.label} tone={c.tone} />;
}
