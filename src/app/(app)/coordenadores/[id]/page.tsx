import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/payments/payment-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPhone, maskCpf } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function CoordinatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  const supabase = await createClient();
  const { data: coordinator } = await supabase
    .from("op_coordinators")
    .select("*, op_profiles(email), op_teams(id, name, default_payment_amount)")
    .eq("id", id)
    .maybeSingle();

  if (!coordinator) notFound();

  const team = Array.isArray(coordinator.op_teams) ? coordinator.op_teams[0] : coordinator.op_teams;
  const profile = Array.isArray(coordinator.op_profiles) ? coordinator.op_profiles[0] : coordinator.op_profiles;

  const { data: members } = team
    ? await supabase
        .from("op_members")
        .select("id, full_name, cpf, phone, active")
        .eq("team_id", team.id)
        .order("full_name")
    : { data: [] };

  const { count: schools } = team
    ? await supabase
        .from("op_team_locations")
        .select("*", { count: "exact", head: true })
        .eq("team_id", team.id)
    : { count: 0 };

  const { data: payments } = team
    ? await supabase
        .from("op_payments")
        .select("amount, op_members!inner(team_id, active)")
        .eq("op_members.team_id", team.id)
        .eq("op_members.active", true)
    : { data: [] };

  const cost = (payments ?? []).reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div>
      <TopBar
        title={coordinator.full_name}
        description="Detalhe do coordenador e da equipe"
        actions={
          team ? (
            <Button asChild>
              <Link href={`/integrantes/novo?team=${team.id}`}>Adicionar integrante</Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge active={coordinator.active} />
        <span>{formatPhone(coordinator.phone ?? "")}</span>
        <span>{profile?.email}</span>
        <span>{maskCpf(coordinator.cpf)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Equipe" value={team?.name ?? "—"} />
        <StatCard label="Pessoas" value={members?.length ?? 0} />
        <StatCard label="Valor por integrante" value={formatCurrency(team?.default_payment_amount ?? 0)} />
        <StatCard label="Custo" value={formatCurrency(cost)} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Escolas" value={schools ?? 0} />
      </div>

      <div className="data-list mt-8 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Integrante</th>
              <th className="px-4 py-3">CPF</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3" data-label="Integrante">
                  <Link href={`/integrantes/${m.id}`} className="font-medium text-primary hover:underline">
                    {m.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3" data-label="CPF">{maskCpf(m.cpf)}</td>
                <td className="px-4 py-3" data-label="Telefone">{formatPhone(m.phone ?? "")}</td>
                <td className="px-4 py-3" data-label="Status">
                  <StatusBadge active={m.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
