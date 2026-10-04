import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { AssignLocationControl } from "@/components/locations/assign-location-control";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpLocation } from "@/types";

export default async function DistributionPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.profile.role === "master") redirect("/integrantes");

  const supabase = await createClient();
  const { data: teamIds } = await supabase.rpc("op_my_team_ids");
  const teamId = Array.isArray(teamIds) ? teamIds[0] : null;
  if (!teamId) redirect("/minha-equipe");

  const [{ data: members }, { data: teamLocations }, { data: assignments }] = await Promise.all([
    supabase.from("op_members").select("id, full_name").eq("team_id", teamId).eq("active", true).order("full_name"),
    supabase.from("op_team_locations").select("op_locations(*)").eq("team_id", teamId),
    supabase.from("op_member_assignments").select("member_id, location_id").eq("team_id", teamId).eq("active", true),
  ]);

  const locations = (teamLocations ?? [])
    .map((tl) => (Array.isArray(tl.op_locations) ? tl.op_locations[0] : tl.op_locations))
    .filter(Boolean) as OpLocation[];

  const assignmentMap = new Map((assignments ?? []).map((a) => [a.member_id, a.location_id]));

  return (
    <div>
      <TopBar
        title="Distribuição"
        description="Atribua cada integrante a um local de atuação vigente"
      />

      {!members?.length ? (
        <EmptyState title="Sem integrantes para distribuir" />
      ) : !locations.length ? (
        <EmptyState
          title="Cadastre locais antes de distribuir"
          description="Adicione escolas na sua equipe para liberar a distribuição."
        />
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <AssignLocationControl
              key={m.id}
              memberId={m.id}
              memberName={m.full_name}
              teamId={teamId}
              locations={locations}
              currentLocationId={assignmentMap.get(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
