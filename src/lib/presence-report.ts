import type { OpPresenceGeoStatus } from "@/types";

export type PresencePingSample = {
  geo_status: OpPresenceGeoStatus;
  recorded_at: string;
};

export type PresenceReport = {
  inside_seconds: number;
  outside_seconds: number;
  uncertain_seconds: number;
  unknown_seconds: number;
  tracked_seconds: number;
  ping_count: number;
  inside_ratio: number;
  first_ping_at: string | null;
  last_ping_at: string | null;
};

const DEFAULT_SEGMENT_SEC = 45;

function statusBucket(status: OpPresenceGeoStatus): keyof Omit<
  PresenceReport,
  "tracked_seconds" | "ping_count" | "inside_ratio" | "first_ping_at" | "last_ping_at"
> {
  switch (status) {
    case "inside":
      return "inside_seconds";
    case "outside":
      return "outside_seconds";
    case "uncertain":
      return "uncertain_seconds";
    default:
      return "unknown_seconds";
  }
}

/** Agrega tempo por status usando duração até o próximo ping (ou 45s no último). */
export function computePresenceReport(
  pings: PresencePingSample[],
  defaultSegmentSec = DEFAULT_SEGMENT_SEC
): PresenceReport {
  const ordered = [...pings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const report: PresenceReport = {
    inside_seconds: 0,
    outside_seconds: 0,
    uncertain_seconds: 0,
    unknown_seconds: 0,
    tracked_seconds: 0,
    ping_count: ordered.length,
    inside_ratio: 0,
    first_ping_at: ordered[0]?.recorded_at ?? null,
    last_ping_at: ordered[ordered.length - 1]?.recorded_at ?? null,
  };

  for (let i = 0; i < ordered.length; i++) {
    const current = ordered[i];
    const next = ordered[i + 1];
    const start = new Date(current.recorded_at).getTime();
    const end = next
      ? new Date(next.recorded_at).getTime()
      : start + defaultSegmentSec * 1000;
    const seconds = Math.max(0, Math.round((end - start) / 1000));
    report[statusBucket(current.geo_status)] += seconds;
    report.tracked_seconds += seconds;
  }

  report.inside_ratio =
    report.tracked_seconds > 0
      ? Math.round((report.inside_seconds / report.tracked_seconds) * 1000) / 10
      : 0;

  return report;
}

export function formatDurationPt(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}
