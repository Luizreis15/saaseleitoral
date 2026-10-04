import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { formatCurrency } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function TeamsPage() {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("op_teams")
    .select("id, name, default_payment_amount, active, op_coordinators(id, full_name)")
    .order("name");

  return (
    <div>
      <TopBar title="Equipes" description="Equipes vinculadas aos coordenadores" />
      <div className="data-list overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Equipe</th>
              <th className="px-4 py-3">Coordenador</th>
              <th className="px-4 py-3">Valor padrão</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(teams ?? []).map((team) => {
              const coordinator = Array.isArray(team.op_coordinators)
                ? team.op_coordinators[0]
                : team.op_coordinators;
              return (
                <tr key={team.id} className="border-t">
                  <td className="px-4 py-3" data-label="Equipe">
                    <Link href={`/equipes/${team.id}`} className="font-medium text-primary hover:underline">
                      {team.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3" data-label="Coordenador">
                    {coordinator ? (
                      <Link href={`/coordenadores/${coordinator.id}`} className="hover:underline">
                        {coordinator.full_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3" data-label="Valor padrão">{formatCurrency(team.default_payment_amount)}</td>
                  <td className="px-4 py-3" data-label="Status">{team.active ? "Ativa" : "Inativa"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
