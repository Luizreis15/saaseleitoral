import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import {
  PresenceLiveBoard,
  type PresenceBoardRow,
} from "@/components/presence/presence-live-board";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpPresenceLinkStatus, OpPresenceReport } from "@/types";

export default async function PresencePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const supabase = await createClient();
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

  const rows: PresenceBoardRow[] = [];

  for (const link of links ?? []) {
    const member = Array.isArray(link.op_members) ? link.op_members[0] : link.op_members;
    const location = Array.isArray(link.op_locations) ? link.op_locations[0] : link.op_locations;
    const sessions = Array.isArray(link.op_presence_sessions)
      ? link.op_presence_sessions
      : link.op_presence_sessions
        ? [link.op_presence_sessions]
        : [];
    const activeSession =
      sessions
        .filter((s) => !s.ended_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ??
      sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ??
      null;

    const nowExpired =
      new Date(link.expires_at).getTime() <= Date.now() && link.status !== "revoked";
    const status = (
      nowExpired && link.status !== "expired" ? "expired" : link.status
    ) as OpPresenceLinkStatus;

    let report: OpPresenceReport | null = null;
    if (activeSession?.id) {
      const { data: reportData, error: reportError } = await supabase.rpc(
        "op_presence_session_report",
        { p_session_id: activeSession.id }
      );
      if (!reportError && reportData) report = reportData as OpPresenceReport;
    }

    rows.push({
      id: link.id,
      status,
      expires_at: link.expires_at,
      created_at: link.created_at,
      ping_interval_sec: link.ping_interval_sec,
      whatsapp_sent_at: link.whatsapp_sent_at ?? null,
      whatsapp_channel: link.whatsapp_channel ?? null,
      member: member ?? null,
      location: location ?? null,
      session: activeSession,
      report,
    });
  }

  return (
    <div>
      <TopBar
        title="Presença"
        description="Ao vivo: quem está perto da escola, envio WhatsApp e tempo dentro/fora do raio"
      />
      <PresenceLiveBoard initialRows={rows} />
    </div>
  );
}
