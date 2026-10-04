import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  PresenceGeoBadge,
  PresenceLinkStatusBadge,
} from "@/components/presence/presence-status-badge";
import { RevokePresenceButton } from "@/components/presence/revoke-presence-button";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

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
      revoked_at,
      created_at,
      ping_interval_sec,
      op_members(id, full_name),
      op_locations(id, name),
      op_presence_sessions(
        id,
        last_status,
        last_distance_m,
        last_ping_at,
        ended_at,
        created_at
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (links ?? []).map((link) => {
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
      sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    const nowExpired = new Date(link.expires_at).getTime() <= Date.now() && link.status !== "revoked";
    const status = nowExpired && link.status !== "expired" ? "expired" : link.status;

    return {
      id: link.id,
      status,
      expires_at: link.expires_at,
      created_at: link.created_at,
      member,
      location,
      session: activeSession ?? null,
    };
  });

  return (
    <div>
      <TopBar
        title="Presença"
        description="Links ativos e última posição dos integrantes perto da escola"
      />

      {!rows.length ? (
        <EmptyState
          title="Nenhum link de presença ainda"
          description="Abra o detalhe de um integrante com local atribuído e gere um link."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {row.member?.id ? (
                        <Link
                          href={`/integrantes/${row.member.id}`}
                          className="hover:underline"
                        >
                          {row.member.full_name}
                        </Link>
                      ) : (
                        "Integrante"
                      )}
                    </p>
                    <PresenceLinkStatusBadge status={row.status} />
                    {row.session ? <PresenceGeoBadge status={row.session.last_status} /> : null}
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
                      {row.session.ended_at ? " · sessão encerrada" : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ainda sem sessão confirmada</p>
                  )}
                </div>
                {row.status === "pending" || row.status === "active" ? (
                  <RevokePresenceButton linkId={row.id} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
