import { formatDurationPt } from "@/lib/presence-report";
import type { OpPresenceReport } from "@/types";

export function PresenceReportCard({
  report,
  title = "Tempo monitorado",
}: {
  report: OpPresenceReport | null | undefined;
  title?: string;
}) {
  if (!report || report.ping_count === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Ainda sem pings suficientes para relatório.</p>
      </div>
    );
  }

  const rows = [
    { label: "Dentro", value: report.inside_seconds, className: "text-emerald-700" },
    { label: "Fora", value: report.outside_seconds, className: "text-rose-700" },
    { label: "GPS impreciso", value: report.uncertain_seconds, className: "text-amber-700" },
  ];

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.ping_count} pings · cobertura na área {report.inside_ratio}%
          </p>
        </div>
        <p className="text-2xl font-semibold text-primary">{report.inside_ratio}%</p>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(100, report.inside_ratio)}%` }}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border bg-slate-50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className={`text-sm font-medium ${row.className}`}>{formatDurationPt(row.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
