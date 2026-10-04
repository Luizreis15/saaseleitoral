import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/20"
      : tone === "warning"
        ? "border-warning/30"
        : tone === "danger"
          ? "border-destructive/30"
          : "border-border";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm md:transition-transform md:duration-300 md:hover:-translate-y-0.5",
        toneClass
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground break-words">{label}</p>
      <p className="mt-2 text-xl font-semibold leading-tight text-foreground tabular-nums sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
