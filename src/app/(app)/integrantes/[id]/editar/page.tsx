import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { MemberForm } from "@/components/members/member-form";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpCity, OpLocation, OpMember, OpTeam } from "@/types";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  const supabase = await createClient();
  const [{ data: member }, { data: cities }, { data: teams }, { data: locations }] = await Promise.all([
    supabase.from("op_members").select("*").eq("id", id).maybeSingle(),
    supabase.from("op_cities").select("*").eq("active", true).order("name"),
    supabase.from("op_teams").select("*").eq("active", true).order("name"),
    supabase.from("op_locations").select("*").eq("active", true).order("name"),
  ]);

  if (!member) notFound();

  return (
    <div>
      <TopBar title="Editar integrante" description={member.full_name} />
      <MemberForm
        mode="edit"
        member={member as OpMember}
        cities={(cities ?? []) as OpCity[]}
        teams={(teams ?? []) as OpTeam[]}
        locations={(locations ?? []) as OpLocation[]}
      />
    </div>
  );
}
