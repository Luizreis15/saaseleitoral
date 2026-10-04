import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { AssignLocationControl } from "@/components/locations/assign-location-control";
import { formatCurrency } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpLocation, TeamStats } from "@/types";

export default async function MyTeamPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.profile.role === "master") redirect("/dashboard");

  const supabase = await createClient();
  const { data: statsData } = await supabase.rpc("op_my_team_stats");
  const stats = (statsData ?? {}) as TeamStats;

  const { data: teamIds } = await supabase.rpc("op_my_team_ids");
  const teamId = Array.isArray(teamIds) ? teamIds[0] : null;

  const { data: members } = teamId
    ? await supabase
        .from("op_members")
        .select("id, full_name, active")
        .eq("team_id", teamId)
        .eq("active", true)
        .order("full_name")
    : { data: [] };

  const { data: teamLocations } = teamId
    ? await supabase
        .from("op_team_locations")
        .select("location_id, op_locations(*)")
        .eq("team_id", teamId)
    : { data: [] };

  const locations: OpLocation[] = (teamLocations ?? [])
    .map((tl) => (Array.isArray(tl.op_locations) ? tl.op_locations[0] : tl.op_locations))
    .filter(Boolean) as OpLocation[];

  const memberIds = (members ?? []).map((m) => m.id);
  const { data: assignments } = memberIds.length
    ? await supabase
        .from("op_member_assignments")
        .select("member_id, location_id")
        .in("member_id", memberIds)
        .eq("active", true)
    : { data: [] };

  const assignmentMap = new Map((assignments ?? []).map((a) => [a.member_id, a.location_id]));

  const grouped = new Map<string, { title: string; members: { id: string; full_name: string; location_id?: string }[] }>();
  grouped.set("none", { title: "Sem local", members: [] });
  for (const loc of locations) {
    grouped.set(loc.id, { title: loc.name, members: [] });
  }

  for (const member of members ?? []) {
    const locId = assignmentMap.get(member.id);
    const bucket = locId && grouped.has(locId) ? grouped.get(locId)! : grouped.get("none")!;
    bucket.members.push({ ...member, location_id: locId });
  }

  return (
    <div>
      <TopBar
        title={`Olá, ${session.profile.full_name.split(" ")[0]}.`}
        description="Visão geral da sua equipe"
        actions={
          <Button asChild>
            <Link href="/minha-equipe/integrantes/novo">Cadastrar integrante</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Minha equipe" value={stats.members_count ?? 0} hint="integrantes" />
        <StatCard label="Locais" value={stats.locations_count ?? 0} hint="escolas" />
        <StatCard
          label="Sem local"
          value={stats.without_location ?? 0}
          tone={(stats.without_location ?? 0) > 0 ? "warning" : "default"}
        />
        <StatCard label="Custo" value={formatCurrency(stats.team_cost ?? 0)} />
      </div>

      {!(members ?? []).length ? (
        <div className="mt-8">
          <EmptyState
            title="Sua equipe ainda está vazia."
            description="Cadastre o primeiro integrante para começar a organizar sua operação."
            action={
              <Button asChild>
                <Link href="/minha-equipe/integrantes/novo">+ Cadastrar integrante</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <h2 className="text-lg font-semibold">Distribuição</h2>
          {Array.from(grouped.entries()).map(([key, group]) => (
            <section key={key} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">{group.title}</h3>
                <span className="text-sm tabular-nums text-muted-foreground">{group.members.length}</span>
              </div>
              {group.members.length ? (
                <ul className="space-y-1">
                  {group.members.map((m) => (
                    <li key={m.id} className="text-sm text-foreground">
                      {m.full_name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum integrante</p>
              )}
            </section>
          ))}

          {(stats.without_location ?? 0) > 0 && teamId ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Atribuir local</h2>
              {grouped.get("none")?.members.map((m) => (
                <AssignLocationControl
                  key={m.id}
                  memberId={m.id}
                  memberName={m.full_name}
                  teamId={teamId}
                  locations={locations}
                />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
