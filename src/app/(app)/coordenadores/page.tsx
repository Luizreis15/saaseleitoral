import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatCurrency, friendlyError, maskCpf } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function CoordinatorsPage() {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  const supabase = await createClient();
  const { data: coordinators, error: coordinatorsError } = await supabase
    .from("op_coordinators")
    .select("id, full_name, phone, cpf, active, op_teams(id, name, default_payment_amount)")
    .order("full_name");

  const rows = await Promise.all(
    (coordinators ?? []).map(async (c) => {
      const team = Array.isArray(c.op_teams) ? c.op_teams[0] : c.op_teams;
      if (!team) {
        return {
          ...c,
          teamName: "—",
          people: 0,
          schools: 0,
          withoutLocation: 0,
          cost: 0,
        };
      }
      const [{ count: people }, { count: schools }, membersRes, paymentsRes] = await Promise.all([
        supabase.from("op_members").select("*", { count: "exact", head: true }).eq("team_id", team.id).eq("active", true),
        supabase.from("op_team_locations").select("*", { count: "exact", head: true }).eq("team_id", team.id),
        supabase.from("op_members").select("id").eq("team_id", team.id).eq("active", true),
        supabase
          .from("op_payments")
          .select("amount, member_id, op_members!inner(team_id, active)")
          .eq("op_members.team_id", team.id)
          .eq("op_members.active", true),
      ]);

      const memberIds = (membersRes.data ?? []).map((m) => m.id);
      let withoutLocation = 0;
      if (memberIds.length) {
        const { data: assigned } = await supabase
          .from("op_member_assignments")
          .select("member_id")
          .in("member_id", memberIds)
          .eq("active", true);
        const assignedSet = new Set((assigned ?? []).map((a) => a.member_id));
        withoutLocation = memberIds.filter((id) => !assignedSet.has(id)).length;
      }

      const cost = (paymentsRes.data ?? []).reduce((acc, p) => acc + Number(p.amount), 0);

      return {
        ...c,
        teamName: team.name,
        people: people ?? 0,
        schools: schools ?? 0,
        withoutLocation,
        cost,
      };
    })
  );

  return (
    <div>
      <TopBar
        title="Coordenadores"
        description="Equipes e cobertura operacional"
        actions={
          <Button asChild>
            <Link href="/coordenadores/novo">Novo coordenador</Link>
          </Button>
        }
      />

      {coordinatorsError ? (
        <EmptyState
          title="Não foi possível carregar os coordenadores"
          description={friendlyError(coordinatorsError.message)}
        />
      ) : !rows.length ? (
        <EmptyState
          title="Nenhum coordenador cadastrado"
          description="Cadastre o primeiro coordenador para iniciar a operação."
          action={
            <Button asChild>
              <Link href="/coordenadores/novo">Cadastrar coordenador</Link>
            </Button>
          }
        />
      ) : (
        <div className="data-list overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Coordenador</th>
                <th className="px-4 py-3">Equipe</th>
                <th className="px-4 py-3">Pessoas</th>
                <th className="px-4 py-3">Escolas</th>
                <th className="px-4 py-3">Sem local</th>
                <th className="px-4 py-3">Custo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-accent/40">
                  <td className="px-4 py-3" data-label="Coordenador">
                    <Link href={`/coordenadores/${row.id}`} className="font-medium text-primary hover:underline">
                      {row.full_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{maskCpf(row.cpf)}</p>
                  </td>
                  <td className="px-4 py-3" data-label="Equipe">{row.teamName}</td>
                  <td className="px-4 py-3 tabular-nums" data-label="Pessoas">{row.people}</td>
                  <td className="px-4 py-3 tabular-nums" data-label="Escolas">{row.schools}</td>
                  <td className="px-4 py-3 tabular-nums" data-label="Sem local">{row.withoutLocation}</td>
                  <td className="px-4 py-3 tabular-nums" data-label="Custo">{formatCurrency(row.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
