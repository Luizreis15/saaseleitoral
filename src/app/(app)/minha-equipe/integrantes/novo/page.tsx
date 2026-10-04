import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { MemberForm } from "@/components/members/member-form";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpCity, OpLocation, OpTeam } from "@/types";

export default async function CoordinatorNewMemberPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.profile.role === "master") redirect("/integrantes/novo");

  const supabase = await createClient();
  const { data: teamIds } = await supabase.rpc("op_my_team_ids");
  const teamId = Array.isArray(teamIds) ? teamIds[0] : null;
  if (!teamId) redirect("/minha-equipe");

  const [{ data: cities }, { data: teams }, { data: teamLocations }] = await Promise.all([
    supabase.from("op_cities").select("*").eq("active", true).order("name"),
    supabase.from("op_teams").select("*").eq("id", teamId),
    supabase.from("op_team_locations").select("op_locations(*)").eq("team_id", teamId),
  ]);

  const locations = (teamLocations ?? [])
    .map((tl) => (Array.isArray(tl.op_locations) ? tl.op_locations[0] : tl.op_locations))
    .filter(Boolean) as OpLocation[];

  return (
    <div>
      <TopBar title="Novo integrante" description="Cadastro na sua equipe" />
      <MemberForm
        cities={(cities ?? []) as OpCity[]}
        teams={(teams ?? []) as OpTeam[]}
        locations={locations}
        lockedTeamId={teamId}
      />
    </div>
  );
}
