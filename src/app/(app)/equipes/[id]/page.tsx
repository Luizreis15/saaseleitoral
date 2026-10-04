import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("op_teams")
    .select("*, op_coordinators(id, full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!team) notFound();
  const coordinator = Array.isArray(team.op_coordinators) ? team.op_coordinators[0] : team.op_coordinators;

  const [{ count: members }, { count: locations }, { data: payments }] = await Promise.all([
    supabase.from("op_members").select("*", { count: "exact", head: true }).eq("team_id", id).eq("active", true),
    supabase.from("op_team_locations").select("*", { count: "exact", head: true }).eq("team_id", id),
    supabase
      .from("op_payments")
      .select("amount, op_members!inner(team_id, active)")
      .eq("op_members.team_id", id)
      .eq("op_members.active", true),
  ]);

  const cost = (payments ?? []).reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div>
      <TopBar
        title={team.name}
        description="Detalhe da equipe"
        actions={
          <>
            {coordinator ? (
              <Button asChild variant="outline">
                <Link href={`/coordenadores/${coordinator.id}`}>Ver coordenador</Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={`/integrantes/novo?team=${team.id}`}>Adicionar integrante</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Coordenador" value={coordinator?.full_name ?? "—"} />
        <StatCard label="Integrantes" value={members ?? 0} />
        <StatCard label="Locais" value={locations ?? 0} />
        <StatCard label="Custo" value={formatCurrency(cost)} />
      </div>
      <div className="mt-4">
        <StatCard label="Valor padrão" value={formatCurrency(team.default_payment_amount)} />
      </div>
    </div>
  );
}
