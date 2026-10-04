import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { MemberForm } from "@/components/members/member-form";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpCity, OpLocation, OpTeam } from "@/types";

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe/integrantes/novo");
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: cities }, { data: teams }, { data: locations }] = await Promise.all([
    supabase.from("op_cities").select("*").eq("active", true).order("name"),
    supabase.from("op_teams").select("*").eq("active", true).order("name"),
    supabase.from("op_locations").select("*").eq("active", true).order("name"),
  ]);

  return (
    <div>
      <TopBar title="Novo integrante" description="Cadastro operacional mobile-first" />
      <MemberForm
        cities={(cities ?? []) as OpCity[]}
        teams={(teams ?? []) as OpTeam[]}
        locations={(locations ?? []) as OpLocation[]}
        lockedTeamId={sp.team}
      />
    </div>
  );
}
