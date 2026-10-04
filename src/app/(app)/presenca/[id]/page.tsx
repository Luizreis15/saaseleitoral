import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import {
  PresenceGeoBadge,
  PresenceLinkStatusBadge,
} from "@/components/presence/presence-status-badge";
import { PresenceReportCard } from "@/components/presence/presence-report-card";
import { RevokePresenceButton } from "@/components/presence/revoke-presence-button";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { computePresenceReport, formatDurationPt } from "@/lib/presence-report";
import type { OpPresenceGeoStatus, OpPresenceReport } from "@/types";

export default async function PresenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const { data: link } = await supabase
    .from("op_presence_links")
    .select(
      `
      id,
      status,
      expires_at,
      created_at,
      ping_interval_sec,
      whatsapp_to,
      whatsapp_sent_at,
      whatsapp_channel,
      whatsapp_error,
      op_members(id, full_name, phone, whatsapp),
      op_locations(id, name, address, latitude, longitude, operational_radius),
      op_presence_sessions(
        id,
        last_status,
        last_distance_m,
        last_ping_at,
        last_latitude,
        last_longitude,
        ended_at,
        end_reason,
        created_at,
        phone_verified_at
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!link) notFound();

  const member = Array.isArray(link.op_members) ? link.op_members[0] : link.op_members;
  const location = Array.isArray(link.op_locations) ? link.op_locations[0] : link.op_locations;
  const sessions = (
    Array.isArray(link.op_presence_sessions)
      ? link.op_presence_sessions
      : link.op_presence_sessions
        ? [link.op_presence_sessions]
        : []
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const current = sessions[0] ?? null;
  let report: OpPresenceReport | null = null;
  let pings: Array<{
    recorded_at: string;
    geo_status: OpPresenceGeoStatus;
    distance_m: number | null;
    accuracy_m: number | null;
  }> = [];

  if (current?.id) {
    const { data: reportData } = await supabase.rpc("op_presence_session_report", {
      p_session_id: current.id,
    });
    if (reportData) {
      report = reportData as OpPresenceReport;
    }

    const { data: pingRows } = await supabase
      .from("op_presence_pings")
      .select("recorded_at, geo_status, distance_m, accuracy_m")
      .eq("session_id", current.id)
      .order("recorded_at", { ascending: false })
      .limit(100);

    pings = (pingRows ?? []) as typeof pings;
    if (!report && pings.length) {
      report = computePresenceReport([...pings].reverse());
    }
  }

  return (
    <div className="space-y-5">
      <TopBar
        title={member?.full_name ?? "Presença"}
        description={`${location?.name ?? "Local"} · link de presença`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/presenca">Voltar</Link>
            </Button>
            {link.status === "pending" || link.status === "active" ? (
              <RevokePresenceButton linkId={link.id} />
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-6">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Status do link</p>
          <div className="mt-1">
            <PresenceLinkStatusBadge status={link.status} />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Última geo</p>
          <div className="mt-1">
            {current ? <PresenceGeoBadge status={current.last_status} /> : <span>—</span>}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Expira</p>
          <p className="font-medium">{new Date(link.expires_at).toLocaleString("pt-BR")}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Raio operacional</p>
          <p className="font-medium">{location?.operational_radius ?? 300} m</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">WhatsApp</p>
          <p className="text-sm">
            {link.whatsapp_sent_at
              ? `Enviado via ${link.whatsapp_channel} em ${new Date(link.whatsapp_sent_at).toLocaleString("pt-BR")}`
              : link.whatsapp_error
                ? `Não enviado: ${link.whatsapp_error}`
                : "Não enviado automaticamente"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Sessão</p>
          <p className="text-sm">
            {current
              ? current.ended_at
                ? `Encerrada (${current.end_reason ?? "fim"})`
                : "Ativa"
              : "Sem confirmação"}
          </p>
        </div>
      </div>

      <PresenceReportCard report={report} title="Relatório de presença" />

      {report && report.tracked_seconds > 0 ? (
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Tempo total monitorado:{" "}
          <span className="font-medium text-foreground">
            {formatDurationPt(report.tracked_seconds)}
          </span>
          {report.first_ping_at && report.last_ping_at ? (
            <>
              {" "}
              · de {new Date(report.first_ping_at).toLocaleTimeString("pt-BR")} até{" "}
              {new Date(report.last_ping_at).toLocaleTimeString("pt-BR")}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-medium">Últimos pings</h3>
        {!pings.length ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum ping registrado.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pings.slice(0, 30).map((ping, idx) => (
              <div
                key={`${ping.recorded_at}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <PresenceGeoBadge status={ping.geo_status} />
                  <span className="text-muted-foreground">
                    {new Date(ping.recorded_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {ping.distance_m != null ? `${ping.distance_m} m` : "—"}
                  {ping.accuracy_m != null ? ` · ±${Math.round(Number(ping.accuracy_m))} m` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
