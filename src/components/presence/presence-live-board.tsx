"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PresenceLiveMap, type LivePresencePoint } from "@/components/presence/presence-live-map";
import {
  PresenceGeoBadge,
  PresenceLinkStatusBadge,
} from "@/components/presence/presence-status-badge";
import { PresenceReportCard } from "@/components/presence/presence-report-card";
import { RevokePresenceButton } from "@/components/presence/revoke-presence-button";
import { createClient } from "@/lib/supabase/client";
import { isPresenceStale } from "@/lib/presence";
import { formatDurationPt } from "@/lib/presence-report";
import type { OpPresenceGeoStatus, OpPresenceLinkStatus, OpPresenceReport } from "@/types";

export type PresenceBoardRow = {
  id: string;
  status: OpPresenceLinkStatus;
  expires_at: string;
  created_at: string;
  ping_interval_sec: number;
  whatsapp_sent_at: string | null;
  whatsapp_channel: string | null;
  member: { id: string; full_name: string } | null;
  location: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    operational_radius: number;
  } | null;
  session: {
    id: string;
    last_status: OpPresenceGeoStatus;
    last_distance_m: number | null;
    last_ping_at: string | null;
    last_latitude: number | null;
    last_longitude: number | null;
    ended_at: string | null;
    created_at: string;
  } | null;
  report: OpPresenceReport | null;
};

export function PresenceLiveBoard({ initialRows }: { initialRows: PresenceBoardRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>(new Date().toISOString());

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: links } = await supabase
      .from("op_presence_links")
      .select(
        `
        id,
        status,
        expires_at,
        created_at,
        ping_interval_sec,
        whatsapp_sent_at,
        whatsapp_channel,
        op_members(id, full_name),
        op_locations(id, name, latitude, longitude, operational_radius),
        op_presence_sessions(
          id,
          last_status,
          last_distance_m,
          last_ping_at,
          last_latitude,
          last_longitude,
          ended_at,
          created_at
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (!links) return;

    setRows((prev) => {
      const prevReportBySession = new Map(
        prev
          .filter((r) => r.session?.id && r.report)
          .map((r) => [r.session!.id, r.report] as const)
      );

      return links.map((link) => {
        const member = Array.isArray(link.op_members) ? link.op_members[0] : link.op_members;
        const location = Array.isArray(link.op_locations) ? link.op_locations[0] : link.op_locations;
        const sessions = Array.isArray(link.op_presence_sessions)
          ? link.op_presence_sessions
          : link.op_presence_sessions
            ? [link.op_presence_sessions]
            : [];
        const session =
          sessions
            .filter((s) => !s.ended_at)
            .sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0] ??
          sessions.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0] ??
          null;

        const nowExpired =
          new Date(link.expires_at).getTime() <= Date.now() && link.status !== "revoked";
        const status = (
          nowExpired && link.status !== "expired" ? "expired" : link.status
        ) as OpPresenceLinkStatus;

        return {
          id: link.id,
          status,
          expires_at: link.expires_at,
          created_at: link.created_at,
          ping_interval_sec: link.ping_interval_sec,
          whatsapp_sent_at: link.whatsapp_sent_at,
          whatsapp_channel: link.whatsapp_channel,
          member: member ?? null,
          location: location ?? null,
          session,
          report: session?.id ? (prevReportBySession.get(session.id) ?? null) : null,
        };
      });
    });
    setUpdatedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("presence-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "op_presence_sessions" },
        () => {
          void refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "op_presence_links" },
        () => {
          void refresh();
        }
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    const poll = window.setInterval(() => {
      void refresh();
    }, 30_000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const activePoints: LivePresencePoint[] = useMemo(
    () =>
      rows
        .filter((r) => r.status === "active" || r.status === "pending")
        .map((r) => ({
          id: r.id,
          memberName: r.member?.full_name?.split(/\s+/)[0] ?? "Integrante",
          locationName: r.location?.name ?? "Local",
          locationLat: r.location?.latitude ?? null,
          locationLng: r.location?.longitude ?? null,
          radius: r.location?.operational_radius ?? 300,
          lastLat: r.session?.last_latitude ?? null,
          lastLng: r.session?.last_longitude ?? null,
          lastStatus: r.session?.last_status ?? null,
          lastPingAt: r.session?.last_ping_at ?? null,
          pingIntervalSec: r.ping_interval_sec,
        })),
    [rows]
  );

  const liveCount = rows.filter(
    (r) =>
      (r.status === "active" || r.status === "pending") &&
      r.session &&
      !r.session.ended_at &&
      !isPresenceStale(r.session.last_ping_at, r.ping_interval_sec)
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{liveCount}</span> presença(s) com ping recente
        </p>
        <p className="text-xs text-muted-foreground">
          {live ? "Realtime conectado" : "Atualização periódica"} ·{" "}
          {new Date(updatedAt).toLocaleTimeString("pt-BR")}
        </p>
      </div>

      <PresenceLiveMap points={activePoints} />

      {!rows.length ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum link de presença ainda. Gere um no detalhe do integrante.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const stale =
              !!row.session &&
              !row.session.ended_at &&
              isPresenceStale(row.session.last_ping_at, row.ping_interval_sec);
            return (
              <div key={row.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {row.member?.id ? (
                          <Link href={`/integrantes/${row.member.id}`} className="hover:underline">
                            {row.member.full_name}
                          </Link>
                        ) : (
                          "Integrante"
                        )}
                      </p>
                      <PresenceLinkStatusBadge status={row.status} />
                      {row.session ? <PresenceGeoBadge status={row.session.last_status} /> : null}
                      {stale ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Offline
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.location?.name ?? "Local"} · expira{" "}
                      {new Date(row.expires_at).toLocaleString("pt-BR")}
                    </p>
                    {row.session?.last_ping_at ? (
                      <p className="text-xs text-muted-foreground">
                        Último ping: {new Date(row.session.last_ping_at).toLocaleString("pt-BR")}
                        {row.session.last_distance_m != null
                          ? ` · ${row.session.last_distance_m} m`
                          : ""}
                        {row.report
                          ? ` · dentro ${formatDurationPt(row.report.inside_seconds)} (${row.report.inside_ratio}%)`
                          : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Ainda sem sessão confirmada</p>
                    )}
                    {row.whatsapp_sent_at ? (
                      <p className="text-xs text-muted-foreground">
                        WhatsApp enviado via {row.whatsapp_channel ?? "api"} em{" "}
                        {new Date(row.whatsapp_sent_at).toLocaleString("pt-BR")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/presenca/${row.id}`}
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent"
                    >
                      Detalhe
                    </Link>
                    {row.status === "pending" || row.status === "active" ? (
                      <RevokePresenceButton linkId={row.id} />
                    ) : null}
                  </div>
                </div>
                {row.report && row.report.ping_count > 0 ? (
                  <div className="mt-3">
                    <PresenceReportCard report={row.report} title="Resumo da sessão" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
